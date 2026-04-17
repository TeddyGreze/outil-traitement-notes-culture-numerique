# Culture Numérique - Outil de traitement automatisé des notes

## Description

Cette application web locale permet de traiter automatiquement les notes de l’UE **Culture Numérique** à partir de plusieurs fichiers CSV.

L’objectif est de faciliter l’import, le contrôle, le calcul et l’export des notes issues de différentes sources, tout en gardant une utilisation simple. L’application fonctionne entièrement **en local dans le navigateur**, sans serveur et sans connexion Internet.

Elle permet de travailler à partir d’un fichier **PEGASE** et de différentes composantes d’évaluation, selon deux modes :

- **Mode classique** : composantes prédéfinies
- **Mode libre** : composantes dynamiques personnalisables

---

## Objectif du projet

Ce projet a été conçu pour automatiser une tâche qui serait longue, répétitive et source d’erreurs si elle était faite manuellement.

L’application permet notamment de :

- importer plusieurs fichiers CSV
- détecter automatiquement certaines colonnes utiles
- ajuster manuellement les colonnes si nécessaire
- configurer les composantes et leurs pondérations
- calculer une note finale sur 20
- remplir automatiquement un fichier PEGASE
- signaler les anomalies détectées
- exporter les résultats en CSV

---

## Fonctionnalités principales

### Paramétrage des composantes

L’application propose deux modes de fonctionnement.

#### Mode classique

Le mode classique repose sur des composantes prédéfinies :

- **PIX**
- **Présences**
- **Recherche documentaire**

L’utilisateur peut :

- activer ou désactiver les composantes
- modifier leurs pondérations
- conserver une somme totale égale à **20**

#### Mode libre

Le mode libre permet de créer des composantes personnalisées.

Pour chaque composante, l’utilisateur peut :

- définir son nom
- définir sa pondération
- activer ou désactiver la composante
- autoriser un ou plusieurs fichiers
- définir le **barème source** de la note lue dans le fichier
- supprimer la composante si nécessaire

---

### Import des fichiers CSV

L’application accepte l’import de fichiers CSV par :

- sélection classique
- glisser-déposer

Les imports possibles sont les suivants :

- **PEGASE**
- **PIX**
- **Présences**
- **Recherche documentaire**
- **composantes libres personnalisées**

Selon le mode choisi, certaines composantes peuvent accepter :

- **un seul fichier**
- **plusieurs fichiers**

---

### Détection et paramétrage des colonnes

L’application essaie automatiquement de reconnaître les colonnes utiles dans les fichiers importés.

Si nécessaire, l’utilisateur peut ouvrir une fenêtre de paramétrage pour choisir manuellement les colonnes correspondant à :

- numéro étudiant
- nom
- prénom
- note ou score
- colonnes spécifiques PIX
- colonne de note PEGASE à remplir

---

### Calcul des notes

Le calcul est réalisé automatiquement à partir des composantes actives.

#### Règles générales

- la note finale est calculée sur **20**
- chaque composante contribue selon sa pondération
- si une composante active n’a pas de fichier importé, sa contribution est considérée comme **0**

#### Types de calcul gérés

- **PIX** : score entre **0 et 1**, converti selon la pondération de la composante
- **Présences** : score sur **5**, converti selon la pondération de la composante
- **Composante notée** : note sur un **barème source configurable**, convertie selon la pondération de la composante

#### Cas particuliers

- pour **PIX**, seules les lignes valides sont retenues selon les conditions prévues
- si plusieurs lignes existent pour un même étudiant, le meilleur résultat utile peut être conservé selon la logique de la composante
- en mode libre, une composante notée peut aussi être traitée à partir de **plusieurs fichiers**

---

### Paramètres avancés

L’application propose un panneau de paramètres avancés permettant de configurer :

#### Mode de remplissage PEGASE

- **Ne rien écraser**
- **Écraser systématiquement**
- **Remplacer seulement si la nouvelle note est supérieure**
- **Remplacer seulement si l’ancienne note est inférieure à 10 et la nouvelle supérieure à 10**

#### Arrondi

- activer ou désactiver l’arrondi
- choisir la méthode :
  - arrondi classique
  - arrondi au supérieur
  - arrondi à l’inférieur
- choisir la précision :
  - au centième
  - au dixième
  - à l’entier

---

### Analyse et affichage des résultats

Après analyse, l’application affiche :

- un **résumé** de l’analyse
- un **tableau principal** des résultats
- un **tableau des anomalies**

Le tableau principal propose :

- une recherche par numéro étudiant, nom ou prénom
- un filtre :
  - tout afficher
  - avec anomalies
  - sans anomalies

---

## Fonctionnement avec ou sans PEGASE

### Avec PEGASE

Si un fichier PEGASE est importé, l’application peut :

- lire la liste des étudiants
- identifier la colonne de note à remplir
- générer un export **PEGASE rempli**
- comparer les étudiants calculés avec ceux présents dans PEGASE

### Sans PEGASE

L’analyse peut aussi être lancée **sans fichier PEGASE**.

Dans ce cas :

- le calcul des notes est quand même effectué
- les tableaux de résultats restent disponibles
- le fichier **PEGASE rempli** n’est pas généré

---

## Exports disponibles

### CSV PEGASE rempli

Permet d’obtenir le fichier PEGASE avec la colonne de note complétée automatiquement, selon les règles de remplissage choisies.

### CSV anomalies

Permet d’exporter :

- toutes les anomalies
- ou uniquement un type précis d’anomalie

### CSV calcul

Permet d’exporter les notes calculées par étudiant, avec le détail des composantes actives et la note finale.

---

## Anomalies détectées

L’application peut détecter plusieurs types de problèmes, par exemple :

- **numéro étudiant invalide**
- **étudiant absent du fichier PEGASE**
- **composante manquante**
- **colonnes attendues introuvables**

Dans certains cas, une **suggestion de numéro étudiant** peut être proposée lorsqu’un rapprochement fiable est possible avec le fichier PEGASE.

---

## Technologies utilisées

Ce projet a été réalisé avec les technologies web suivantes :

- **HTML**
- **CSS**
- **JavaScript**

L’application ne nécessite ni framework externe, ni serveur backend.

---

## Utilisation

### 1. Ouvrir l’application

Ouvrir le fichier `index.html` dans un navigateur.

### 2. Choisir le mode

Sélectionner :

- **Mode classique**
- ou **Mode libre**

### 3. Paramétrer les composantes

Définir les composantes actives et leurs pondérations.

### 4. Importer les fichiers

Importer les fichiers CSV nécessaires selon les composantes choisies.

### 5. Vérifier le paramétrage

Si besoin, ajuster manuellement les colonnes reconnues par l’application.

### 6. Lancer l’analyse

Cliquer sur le bouton **Analyser**.

### 7. Consulter les résultats

Lire :

- le résumé
- le tableau principal
- le tableau des anomalies

### 8. Exporter les fichiers

Exporter ensuite les fichiers générés selon le besoin.

---

## Compatibilité

L’application fonctionne dans les navigateurs.

### Navigateurs recommandés

- Chrome
- Firefox
- Edge

### Remarque pour macOS

Sur macOS, **Safari** peut imposer certaines limitations concernant l’import et l’export de fichiers locaux. Il est donc préférable d’utiliser **Chrome**, **Firefox** ou **Edge**.

---

## Auteur

Projet réalisé par **Teddy GREZE**.

---

## Version

Version actuelle : **1.2.0**
