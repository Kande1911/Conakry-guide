# Conakry Guide

Application de découverte d’établissements à Conakry. Les établissements sont lus depuis l’API externe documentée ; les comptes et avis appartiennent à l’application et sont stockés dans PostgreSQL.

Voir [docs/architecture-and-deployment.md](docs/architecture-and-deployment.md) pour les décisions d’architecture, le modèle de données et la procédure de mise en production.

## Configuration locale

1. Copier `.env.example` vers `.env`.
2. Configurer `EXTERNAL_API_URL=https://maps.djengoo.com/api/places/` dans `.env.local`. Pour cette API, ajouter `EXTERNAL_API_AUTH_HEADER=X-API-KEY` et sa valeur privée dans `.env.local`; ne jamais inscrire la clé dans le dépôt.
3. Renseigner `DATABASE_URL`, `BETTER_AUTH_SECRET` (au moins 32 caractères aléatoires), `BETTER_AUTH_URL` et `SITE_URL`. À la création par e-mail, le mot de passe doit contenir au moins 8 caractères.
4. Appliquer les migrations avec `npm run db:migrate`.
5. Démarrer l’application avec `npm run dev`.

La liste est chargée par lots de 50 au fil de la navigation ; les recherches et filtres utilisent l’endpoint de recherche du fournisseur. `EXTERNAL_API_REVALIDATE_SECONDS` règle le cache des données publiques (300 secondes par défaut).

Pour activer « Continuer avec Google » sur les pages de connexion et de création de compte, ajoutez `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET` dans `.env`. Dans Google Cloud Console, créez un identifiant OAuth de type application Web et autorisez `http://localhost:3000/api/auth/callback/google` en local ainsi que `https://votre-domaine/api/auth/callback/google` en production. Le bouton apparaît lorsque les deux variables sont renseignées. Gardez le secret OAuth côté serveur.

Les migrations sont versionnées dans `drizzle/migrations`. Le script vérifie leur empreinte et prend un verrou PostgreSQL pour éviter deux exécutions concurrentes.

## Routes applicatives

- `GET /api/establishments` et `GET /api/establishments/:id` transmettent les lectures à l’API externe.
- Better Auth gère les comptes sur `/api/auth/*`.
- `GET /api/establishments/:id/reviews` retourne les avis publiés.
- `POST /api/establishments/:id/reviews` exige une session et crée un avis.
- `GET`, `PATCH` et `DELETE /api/establishments/:id/reviews/me` permettent à l’auteur de lire, modifier ou retirer son avis.

PostgreSQL impose une contrainte unique sur `(user_id, establishment_id)`. Une suppression d’avis le marque comme retiré au lieu de supprimer sa ligne : l’auteur ne peut donc pas contourner la règle en supprimant puis en recréant un avis.

Les endpoints Better Auth sont limités en débit par PostgreSQL. Les écritures d’avis sont limitées à cinq actions par utilisateur sur une fenêtre de dix minutes. Pour exécuter les six tests d’intégration, démarrez l’application sur `localhost` avec une base isolée dont le nom contient `test`, puis lancez `npm run test:integration` avec `TEST_BASE_URL` et `TEST_DATABASE_URL` configurés.

Pour attribuer le rôle administrateur après la création du compte, utilisez `npm run admin:promote -- administrateur@example.com` depuis un environnement qui a accès à la base. Le rôle ne peut pas être choisi ou modifié depuis les formulaires publics. Les changements de modération sont conservés dans `review_moderation_log`.
