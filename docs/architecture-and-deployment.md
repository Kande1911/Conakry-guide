# Architecture et mise en production

## Choix d’architecture

- **Next.js, React, TypeScript et Tailwind CSS** : une seule application sert les pages et les Route Handlers. L’API fournisseur reste appelée côté serveur ; ses en-têtes éventuels ne sont jamais envoyés au navigateur.
- **PostgreSQL** : il porte les relations entre comptes et avis, les index de lecture et la contrainte atomique d’un avis par compte et établissement.
- **Drizzle ORM** : accès SQL paramétré avec des migrations SQL contrôlées dans le dépôt. Prisma 7 avait signalé plusieurs vulnérabilités élevées dans l’arbre effectivement installé ; le choix a été remplacé avant d’écrire le schéma.
- **Better Auth** : gère les mots de passe, sessions et cookies. Le rôle `user` est attribué par le serveur et n’est pas modifiable dans les formulaires publics.
- **Connexion Google** : connexion et création de compte OAuth activées avec `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET`. À l’inscription par e-mail, le mot de passe comporte au moins huit caractères.
- **Images** : les URLs restent celles de la source externe. Aucun fichier n’est téléchargé ou recopié tant que les droits de stockage ne sont pas confirmés.

### Hébergement : options

| Option | Convient si… | Points à prévoir ici |
|---|---|---|
| Vercel | la priorité est l’intégration Next.js et les déploiements d’aperçu liés à Git | PostgreSQL reste un service séparé ; régler le pool de connexions pour l’exécution serverless |
| Render | on préfère un service Node avec commandes `npm run build` / `npm run start` et une base séparée | migrations avant bascule ; choisir une offre qui garde le service actif si les démarrages à froid ne conviennent pas |
| Railway | on souhaite regrouper projet applicatif et PostgreSQL dans un même espace de déploiement | leur guide Next.js demande une sortie `standalone` ; adapter `next.config.ts` et la commande de démarrage avant de choisir cette voie |

Vercel documente une intégration Next.js native et les aperçus de déploiement ; Render documente le lancement de Next SSR comme service Node avec une commande de build et de démarrage ; Railway documente une base PostgreSQL associable au service, mais son parcours Next.js utilise `output: "standalone"`. Le code reste sur `next build` / `next start` tant que l’hébergeur n’est pas choisi. Références officielles : [Next.js sur Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs), [déployer une application Next.js sur Render](https://render.com/docs/deploy-nextjs-app), [Next.js avec PostgreSQL sur Railway](https://docs.railway.com/guides/nextjs), [héberger Next.js soi-même](https://nextjs.org/docs/app/guides/self-hosting).

Pour une exécution serverless, définir `DATABASE_POOL_MAX` à une valeur basse et utiliser le pooler PostgreSQL recommandé par le fournisseur. Pour une instance Node persistante, commencer avec une limite modeste et la calculer selon le nombre d’instances et le quota PostgreSQL.

### Données externes et données de la plateforme

Pour l’instant, les fiches sont lues directement depuis l’API externe et transformées dans `lib/external-api/mapper.ts`. PostgreSQL ne duplique pas les établissements ; chaque avis garde l’identifiant externe en `text`, ce qui accepte un identifiant documenté comme nombre ou chaîne.

Ce choix respecte la documentation reçue : elle ne précise ni pagination fournisseur, ni autorisation de cache ou de réplication. La contrepartie est que l’affichage des établissements dépend de la disponibilité de l’API. Un cache ou un index local pourra être ajouté après confirmation des droits et règles de rafraîchissement.

Les champs de fiche actuellement utilisés sont `id`, `nom`, `categorie`, les URLs d’images, `description`, `adresse` et les coordonnées. Seuls l’identifiant, le nom et la catégorie sont exigés par le mapper ; les informations illustratives, horaires, téléphones et liens sociaux ne sont pas supposés présents.

La source ne documente pas de date de création pour les établissements. La section « Récemment commentés » et le tri correspondant utilisent donc la date des derniers avis publiés dans Conakry Guide ; ils ne prétendent pas classer les établissements selon leur date d’ajout chez le fournisseur.

Les adresses populaires sont classées par nombre d’avis publiés, les mieux notées par moyenne puis nombre d’avis. La sélection recommandée utilise une moyenne bayésienne qui rapproche les établissements avec peu d’avis de la moyenne générale, afin qu’un avis isolé ne suffise pas à les placer en tête.

## Tables et intégrité

- `user`, `session`, `account`, `verification`, `rate_limit` : tables Better Auth.
- `review` : utilisateur, identifiant externe, note, commentaire, statut et dates.
- `review_write_limit` : compteur par compte, fenêtre de dix minutes, cinq écritures au maximum.
- `review_moderation_log` : historique transactionnel des publications et masquages.
- 
`review_user_establishment_unique` protège la règle métier même en cas de requêtes simultanées. Les avis retirés restent dans `review` avec le statut `removed`, ce qui empêche une suppression suivie d’une nouvelle publication. Les notes sont limitées à 1–5 et le commentaire est obligatoire et borné en base comme dans la route.

Les lectures publiques ne retournent que les avis `published`. Les agrégats (moyenne, nombre, distribution) sont calculés depuis ces lignes. Les changements de statut par l’administration se font dans une transaction et sont inscrits dans le journal.

## Contrat des routes internes

- `GET /api/establishments` et `GET /api/establishments/:id` : proxy serveur vers les deux appels externes documentés.
- `/api/auth/*` : inscription, connexion, session et déconnexion Better Auth.
- `GET /api/establishments/:id/reviews?page=1` : liste publique, résumé des notes et pagination interne de 20 avis.
- `POST /api/establishments/:id/reviews` : crée un avis après contrôle de session.
- `GET`, `PATCH`, `DELETE /api/establishments/:id/reviews/me` : opérations limitées à l’auteur.
- `GET /api/profile/reviews?page=1` : liste privée de ses avis.
- `GET /api/admin/reviews?status=hidden&page=1` et `PATCH /api/admin/reviews/:id` : modération avec autorisation serveur.
- `GET /api/health` : vérifie la disponibilité de PostgreSQL sans retourner de détail de connexion.

La pagination des avis et le bouton « afficher plus » sont internes ; aucun paramètre n’est envoyé à l’API fournisseur, car elle ne documente pas de pagination. La recherche et les filtres d’établissement portent sur les données reçues : nom, catégorie, adresse et description.

## Configuration

Copier `.env.example` vers `.env` et renseigner localement :

- `EXTERNAL_API_URL` : URL réelle de la collection communiquée par le fournisseur. `api.exemple.com` dans le document est une valeur illustrative, pas une adresse de production.
- `EXTERNAL_API_AUTH_HEADER` et `EXTERNAL_API_AUTH_VALUE` : seulement si le fournisseur confirme le mécanisme exact.
- `DATABASE_URL` : chaîne privée vers PostgreSQL 13 ou supérieur (`gen_random_uuid()` est utilisé par la migration).
- `BETTER_AUTH_SECRET` : valeur aléatoire d’au moins 32 caractères.
- `BETTER_AUTH_URL` et `SITE_URL` : origine publique exacte de l’application ; HTTPS en production.
- `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET` : identifiants OAuth Google facultatifs. Déclarer dans Google Cloud Console l’URI de rappel `{BETTER_AUTH_URL}/api/auth/callback/google` (et l’URI localhost pour le développement).

Ne transmettez aucun mot de passe, token ou chaîne `DATABASE_URL` dans le dépôt ou dans une capture. Les fichiers `.env*` sont ignorés par Git, sauf `.env.example`.

## Mise en production

1. Créer le dépôt Git et déployer une application Next.js sur un hébergeur Node compatible avec Next 16. Garder PostgreSQL comme service séparé afin de sauvegarder et restaurer la base indépendamment du code.
2. Créer des bases distinctes pour développement, tests et production. Le rôle PostgreSQL de l’application doit avoir uniquement les droits nécessaires à l’exécution des migrations et de l’application.
3. Configurer les variables serveur dans l’environnement de déploiement : `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `SITE_URL`, `EXTERNAL_API_URL`, puis `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET` si la connexion Google est activée, ainsi que les en-têtes d’authentification fournisseur si confirmés.
4. Construire avec `npm ci` puis `npm run build`. Dans l’étape de release, avant de router du trafic vers la nouvelle version, exécuter `npm run db:migrate` avec la même `DATABASE_URL` de production. Ne pas lancer les migrations à chaque démarrage de chaque instance.
5. Lancer l’application avec `npm run start`, vérifier `/api/health`, l’inscription, les deux lectures externes et les avis avant d’ouvrir le trafic.
6. Attacher le domaine, activer HTTPS chez l’hébergeur et définir `SITE_URL` et `BETTER_AUTH_URL` sur l’origine HTTPS finale. Ne pas utiliser HTTP en production.
7. Activer les sauvegardes PostgreSQL automatiques et tester une restauration. Surveiller les réponses 5xx de l’API externe, `/api/health`, les erreurs serveur et la saturation des connexions.
8. Pour publier une version, appliquer les migrations compatibles avant le basculement. Si une version échoue, revenir au build précédent ; ne pas supprimer ou réécrire une migration déjà appliquée.

La procédure de choix d’hébergeur, de domaine et de base dépendra du budget, du pays de la base, du volume attendu et des services déjà utilisés. Elle n’est pas fixée dans le code.

## Suite requise avant les tests d’intégration

Il faut une vraie URL fournisseur, un schéma d’authentification confirmé (sans envoyer le secret ici), et une base PostgreSQL locale ou de test. Les six cas critiques sont dans `tests/reviews.integration.test.mjs` ; le test refuse les URL distantes et les bases dont le nom ne contient pas `test`.

Exemple de préparation dans PowerShell, avec une base de test locale déjà créée :

```powershell
# Terminal 1 : configurer la base isolée, générer un secret local et démarrer l’application
$env:DATABASE_URL = "<URL PostgreSQL vers conakry_guide_test>"
$env:BETTER_AUTH_SECRET = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
$env:BETTER_AUTH_URL = "http://localhost:3000"
$env:SITE_URL = "http://localhost:3000"
npm run db:migrate
npm run dev
```

Dans un second terminal, avec la même URL de test :

```powershell
$env:TEST_BASE_URL = "http://localhost:3000"
$env:TEST_DATABASE_URL = "<la même URL PostgreSQL de test>"
npm run test:integration
```
