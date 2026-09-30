import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import pg from "pg";

const { Pool } = pg;
const baseValue = process.env.TEST_BASE_URL;
const databaseValue = process.env.TEST_DATABASE_URL;
const enabled = Boolean(baseValue && databaseValue && process.env.NODE_ENV !== "production");

function validatedTestSettings() {
  if (!baseValue || !databaseValue) throw new Error("TEST_BASE_URL and TEST_DATABASE_URL are required");
  const baseUrl = new URL(baseValue);
  const databaseUrl = new URL(databaseValue);
  const databaseName = decodeURIComponent(databaseUrl.pathname).replace(/^\//, "");

  if (!new Set(["localhost", "127.0.0.1", "::1"]).has(baseUrl.hostname)) {
    throw new Error("Integration tests are restricted to a locally running app");
  }
  if (!/test/i.test(databaseName)) {
    throw new Error("TEST_DATABASE_URL must point to a database whose name contains 'test'");
  }

  return { baseUrl, databaseUrl };
}

async function jsonRequest(url, { cookie, method = "GET", body } = {}) {
  const headers = new Headers();
  if (cookie) headers.set("Cookie", cookie);
  if (method !== "GET") headers.set("Origin", new URL(url).origin);
  if (body !== undefined) headers.set("Content-Type", "application/json");
  return fetch(url, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    redirect: "manual",
  });
}

async function createAccount(baseUrl, email) {
  const response = await jsonRequest(new URL("/api/auth/sign-up/email", baseUrl), {
    method: "POST",
    body: { name: "Compte de test", email, password: `Test-${randomUUID()}-Aa9!` },
  });
  assert.equal(response.status, 200, `signup failed: ${response.status} ${await response.text()}`);
  const cookies = response.headers.getSetCookie().map((value) => value.split(";", 1)[0]);
  assert.ok(cookies.length, "signup should set an authentication cookie");
  return cookies.join("; ");
}

async function createReview(baseUrl, establishmentId, cookie, rating, comment) {
  return jsonRequest(new URL(`/api/establishments/${encodeURIComponent(establishmentId)}/reviews`, baseUrl), {
    method: "POST",
    cookie,
    body: { rating, comment },
  });
}

test("critical review rules (requires a local app and an isolated PostgreSQL test database)", {
  skip: !enabled,
}, async (t) => {
  const { baseUrl, databaseUrl } = validatedTestSettings();
  const runId = randomUUID();
  const establishmentId = `integration-${runId}`;
  const concurrentEstablishmentId = `integration-race-${runId}`;
  const emails = [
    `review-a-${runId}@example.test`,
    `review-b-${runId}@example.test`,
    `review-race-${runId}@example.test`,
  ];
  const pool = new Pool({ connectionString: databaseUrl.toString() });

  try {
    // Keep Better Auth's endpoint throttles from leaking across repeated local test runs.
    await pool.query("DELETE FROM rate_limit");

    const anonymous = await createReview(baseUrl, establishmentId, undefined, 5, "Avis sans session");
    await t.test("1. refuse un avis sans session", () => assert.equal(anonymous.status, 401));

    const firstCookie = await createAccount(baseUrl, emails[0]);
    const first = await createReview(baseUrl, establishmentId, firstCookie, 5, "Très belle adresse.");
    await t.test("2. accepte le premier avis authentifié", () => assert.equal(first.status, 201));

    const duplicate = await createReview(baseUrl, establishmentId, firstCookie, 4, "Un second avis.");
    await t.test("3. refuse le second avis du même utilisateur", async () => {
      assert.equal(duplicate.status, 409, await duplicate.text());
    });

    const update = await jsonRequest(
      new URL(`/api/establishments/${encodeURIComponent(establishmentId)}/reviews/me`, baseUrl),
      { method: "PATCH", cookie: firstCookie, body: { rating: 4, comment: "J’ai mis à jour mon expérience." } },
    );
    await t.test("4. autorise la modification de l’avis existant", () => assert.equal(update.status, 200));

    const secondCookie = await createAccount(baseUrl, emails[1]);
    const secondUserReview = await createReview(baseUrl, establishmentId, secondCookie, 5, "Mon expérience à cette adresse.");
    await t.test("5. accepte un avis d’un autre utilisateur sur la même adresse", () => assert.equal(secondUserReview.status, 201));

    const concurrentCookie = await createAccount(baseUrl, emails[2]);
    const concurrentResponses = await Promise.all([
      createReview(baseUrl, concurrentEstablishmentId, concurrentCookie, 4, "Requête concurrente numéro un."),
      createReview(baseUrl, concurrentEstablishmentId, concurrentCookie, 3, "Requête concurrente numéro deux."),
    ]);
    const concurrentStatuses = concurrentResponses.map(({ status }) => status).sort((a, b) => a - b);
    await t.test("6. une seule requête concurrente réussit en base", () => {
      assert.deepEqual(
        concurrentStatuses,
        [201, 409],
        concurrentResponses.map(({ status }) => status).join(", "),
      );
    });
  } finally {
    try {
      await pool.query(
        `DELETE FROM review
         WHERE user_id IN (SELECT id FROM "user" WHERE email = ANY($1::text[]))`,
        [emails],
      );
      await pool.query('DELETE FROM "user" WHERE email = ANY($1::text[])', [emails]);
    } finally {
      await pool.end();
    }
  }
});
