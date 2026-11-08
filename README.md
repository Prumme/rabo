# Rabo

Liste de courses personnelle. **Réserve** contient tes produits habituels. **À acheter** affiche ceux dont la quantité demandée est supérieure à zéro.

## Démarrer en local

Avec Node.js 24 ou ultérieur :

```sh
npm ci
cp .env.example .env.local
```

Dans `.env.local`, renseigne un mot de passe unique dans `RABO_PASSWORD`, puis génère deux valeurs indépendantes pour `RABO_SESSION_SECRET` et `RABO_SHORTCUT_TOKEN` en exécutant deux fois `openssl rand -hex 32`.

```sh
npm run dev
```

Ouvre [Rabo en local](http://localhost:3000) et saisis le mot de passe. La liste et la réserve démarrent vides.

## Hébergement

Déploie une instance Node avec un disque persistant et un proxy HTTPS. Configure les trois secrets dans l’environnement et pointe `RABO_DB_PATH` vers un fichier dans le volume monté, par exemple `/data/rabo.sqlite`. Lance `npm ci`, `npm run build` et `npm start`. Le cookie de production requiert HTTPS. Sauvegarde la base via la commande SQLite `.backup` ou un instantané cohérent du volume. Pour remplacer le jeton du raccourci, change `RABO_SHORTCUT_TOKEN`, redémarre le serveur et mets à jour le raccourci.

## Serveur OVH

Rabo utilise Docker Compose dans `/opt/rabo`. Caddy achemine `rabo.prumme.dev` vers `rabo:3000` sur le réseau Docker `prumme-proxy`. Les données sont dans `/opt/rabo/data` et les secrets dans `/opt/rabo/.env` (lecture root uniquement).

Sur le serveur, récupère les deux valeurs nécessaires depuis ton terminal privé :

```sh
sudo grep '^RABO_PASSWORD=' /opt/rabo/.env
sudo grep '^RABO_SHORTCUT_TOKEN=' /opt/rabo/.env
```

Pour vérifier l’état et les journaux :

```sh
cd /opt/rabo
sudo docker compose ps
sudo docker compose logs --tail=50 rabo
```

Pour une mise à jour, transfère les sources et les fichiers Docker dans `/opt/rabo`, en conservant `.env` et `data/`, puis exécute `sudo docker compose up -d --build` depuis ce dossier.

## Configurer « Ajoute à mes courses » sur iPhone

1. Crée un raccourci nommé **Ajoute à mes courses**. Ajoute **Demander une entrée**, de type Texte, avec la question « Quel produit ? ». Conserve le résultat dans la variable **Produit**.
2. Génère un identifiant par exécution. Combine la date actuelle formatée en `yyyyMMddHHmmssSSS` avec deux résultats indépendants de l’action **Nombre aléatoire** (entre 100000000 et 999999999). Sépare les trois valeurs par des tirets dans une action **Texte** et conserve le résultat dans **ID**.
3. Ajoute **Obtenir le contenu de l’URL**. Utilise `https://ton-domaine/api/shortcuts/add`, la méthode **POST** et l’en-tête `Authorization` avec la valeur `Bearer <ton jeton RABO_SHORTCUT_TOKEN>`. Choisis un corps **JSON** avec deux champs Texte, `name` contenant **Produit** et `requestId` contenant **ID**.
4. Lis la clé `status` de la réponse avec **Obtenir la valeur du dictionnaire**. Si elle vaut `needs_confirmation`, récupère aussi `name` et propose un menu « Créer et ajouter [nom] ? » avec **Créer** et **Annuler**. Sur **Annuler**, arrête le raccourci. Sur **Créer**, répète l’appel avec le même nom dicté et le même **ID**, en ajoutant le champ booléen `confirmCreate` à vrai.
5. Quand le résultat vaut `added`, lis les valeurs `name` et `quantity` de la réponse finale et utilise **Énoncer le texte** pour dire « [nom] ajouté. Quantité à acheter [quantité]. » En cas d’échec HTTP ou réseau, laisse Raccourcis afficher son erreur. Si tu configures une relance automatique de l’appel, réutilise **ID**.
6. Lance le raccourci depuis l’app une première fois pour accorder les autorisations demandées. Puis dis « Dis Siri, ajoute à mes courses » et réponds « Lait ». Teste la création, un deuxième ajout et l’annulation pour un autre nom. Ouvre Rabo sur l’iPhone pour vérifier le total.

Les réponses de succès et de confirmation utilisent HTTP 200. Un jeton incorrect renvoie 401. Un identifiant d’ajout déjà traité renvoie le résultat d’origine. Le jeton doit rester privé, notamment si tu partages une copie du raccourci.
