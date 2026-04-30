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
- configurer les composantes d’évaluation
- choisir une pondération par points ou par coefficients
- calculer une note finale sur 20
- remplir automatiquement un fichier PEGASE
- signaler les anomalies détectées
- consulter les résultats dans des tableaux paginés
- sauvegarder et recharger une configuration avec un preset JSON
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
- modifier leur pondération
- choisir une pondération par points ou par coefficients
- garder un calcul final ramené sur **20**

Les composantes classiques sont adaptées au fonctionnement habituel de l’UE Culture Numérique.

#### Mode libre

Le mode libre permet de créer des composantes personnalisées.

Pour chaque composante, l’utilisateur peut :

- définir son nom
- définir sa pondération
- activer ou désactiver la composante
- autoriser un ou plusieurs fichiers
- définir le **barème source** de la note lue dans le fichier
- supprimer la composante si nécessaire

Ce mode permet de traiter des structures d’évaluation plus souples, lorsque les composantes ne correspondent pas exactement au mode classique.

---

## Méthode de pondération

L’application propose deux méthodes de pondération.

### Points sur /20

Dans ce mode, l’utilisateur indique directement le nombre de points attribués à chaque composante.

Exemple :

```text
PIX : 15 points
Présences : 5 points
```

La somme des composantes actives doit être égale à **20**.

### Coefficients

Dans ce mode, l’utilisateur indique des coefficients.

L’application calcule automatiquement la répartition correspondante sur **20**.

Exemple :

```text
PIX : coefficient 3
Présences : coefficient 1
```

Ce qui correspond à :

```text
PIX : 15 points
Présences : 5 points
```

Ce mode permet de raisonner avec des coefficients tout en conservant une note finale sur 20.

---

## Presets de configuration

L’application permet de sauvegarder et de recharger des presets au format **JSON**.

### Sauvegarder un preset

Le bouton **Sauvegarder preset** permet d’exporter la configuration actuelle dans un fichier `.json`.

Le preset contient notamment :

- le mode choisi : classique ou libre
- la méthode de pondération : points ou coefficients
- les composantes actives
- les points ou coefficients
- les barèmes sources
- les options multi-fichiers
- les mappings de colonnes
- les paramètres avancés
- le mapping PEGASE

L’utilisateur peut choisir un nom pour le preset. Si aucun nom n’est indiqué, l’application génère un nom automatique avec un horodatage.

### Charger un preset

Le bouton **Charger preset** permet de réimporter un fichier JSON précédemment sauvegardé.

Le chargement d’un preset restaure la configuration de l’application.

Un preset ne contient pas les fichiers CSV importés. Après le chargement d’un preset, les fichiers CSV nécessaires doivent donc être réimportés.

---

## Import des fichiers CSV

L’application accepte l’import de fichiers CSV par :

- sélection classique
- glisser-déposer

Les imports possibles sont les suivants :

- **PEGASE**
- **PIX**
- **Présences**
- **Recherche documentaire**
- **composantes libres personnalisées**

Selon le mode choisi et les réglages de la composante, l’import peut accepter :

- **un seul fichier**
- **plusieurs fichiers**

Chaque carte d’import affiche son état :

- **En attente**
- **Importé**

Il est aussi possible de vider une carte d’import.

---

## Détection et paramétrage des colonnes

L’application essaie automatiquement de reconnaître les colonnes utiles dans les fichiers importés.

Si nécessaire, l’utilisateur peut ouvrir une fenêtre de paramétrage pour choisir manuellement les colonnes correspondant à :

- numéro étudiant
- nom
- prénom
- note ou score
- colonnes spécifiques PIX
- colonne de note PEGASE à remplir

Pour les composantes multi-fichiers, le paramétrage peut être fait fichier par fichier.

---

## Calcul des notes

Le calcul est réalisé automatiquement à partir des composantes actives.

### Règles générales

- la note finale est calculée sur **20**
- chaque composante contribue selon sa pondération
- si une composante active n’a pas de fichier importé, sa contribution est considérée comme **0**
- les notes peuvent être arrondies selon les paramètres choisis

### Types de calcul gérés

#### PIX

Le score PIX est un score compris entre **0 et 1**.

La contribution est calculée ainsi :

```text
score PIX × pondération de la composante
```

Exemple :

```text
0,80 × 15 = 12
```

#### Présences

Le score de présence est traité sur **5**.

La contribution est calculée ainsi :

```text
(score / 5) × pondération de la composante
```

Exemple :

```text
(4 / 5) × 5 = 4
```

#### Composante notée

Une composante notée peut avoir un barème source configurable.

La contribution est calculée ainsi :

```text
(note source / barème source) × pondération de la composante
```

Exemple avec une note sur 20 :

```text
(16 / 20) × 10 = 8
```

Exemple avec une note sur 50 :

```text
(40 / 50) × 10 = 8
```

---

## Paramètres avancés

L’application propose un panneau de paramètres avancés permettant de configurer le remplissage PEGASE et l’arrondi des notes.

### Mode de remplissage PEGASE

Les modes disponibles sont :

- **Ne rien écraser**
- **Écraser systématiquement**
- **Remplacer seulement si la nouvelle note est supérieure**
- **Remplacer seulement si l’ancienne note est inférieure à 10 et la nouvelle supérieure à 10**

### Arrondi

L’utilisateur peut :

- activer ou désactiver l’arrondi
- choisir la méthode d’arrondi
- choisir la précision

Méthodes disponibles :

- arrondi classique
- arrondi au supérieur
- arrondi à l’inférieur

Précisions disponibles :

- au centième
- au dixième
- à l’entier

Un aperçu est affiché dans la fenêtre des paramètres avancés pour montrer le résultat de l’arrondi.

---

## Analyse et affichage des résultats

Après analyse, l’application affiche :

- un **résumé** de l’analyse
- un onglet **Aperçu des notes**
- un onglet **Anomalies**

Chaque onglet affiche un compteur de lignes.

### Onglet Aperçu des notes

Cet onglet affiche les notes calculées pour les étudiants.

Il contient notamment :

- le numéro étudiant
- le nom
- le prénom
- les contributions des composantes actives
- la note finale sur 20
- le statut de l’étudiant, par exemple **PEGASE** ou **Hors PEGASE**

Le tableau propose :

- une recherche par numéro étudiant, nom ou prénom
- un filtre :
  - tout afficher
  - avec anomalies
  - sans anomalies
- une pagination automatique

### Onglet Anomalies

Cet onglet affiche les anomalies détectées pendant l’analyse.

Le tableau propose :

- une recherche dans les anomalies
- un filtre par type d’anomalie
- une pagination automatique

Les colonnes affichées peuvent contenir :

- type d’anomalie
- source
- fichier concerné
- numéro étudiant trouvé
- nom
- prénom
- suggestion de numéro étudiant
- détail de l’anomalie

La colonne de suggestion est affichée seulement lorsqu’une suggestion existe.

### Pagination

Les tableaux sont paginés afin de rester lisibles même avec beaucoup d’étudiants.

Par défaut, l’application affiche **50 lignes par page**.

---

## Fonctionnement avec ou sans PEGASE

### Avec PEGASE

Si un fichier PEGASE est importé, l’application peut :

- lire la liste des étudiants
- identifier la colonne de note à remplir
- générer un export **PEGASE rempli**
- comparer les étudiants calculés avec ceux présents dans PEGASE
- repérer les étudiants absents du fichier PEGASE

### Sans PEGASE

L’analyse peut aussi être lancée **sans fichier PEGASE**.

Dans ce cas :

- le calcul des notes est quand même effectué
- les tableaux de résultats restent disponibles
- le fichier **PEGASE rempli** n’est pas généré
- certaines anomalies liées au fichier PEGASE ne peuvent pas être produites

---

## Exports disponibles

### CSV PEGASE rempli

Permet d’obtenir le fichier PEGASE avec la colonne de note complétée automatiquement, selon les règles de remplissage choisies.

Cet export est disponible uniquement si un fichier PEGASE a été importé.

### CSV anomalies

Permet d’exporter :

- toutes les anomalies
- ou uniquement un type précis d’anomalie

Le fichier exporté contient les colonnes utiles selon les anomalies présentes.

### CSV calcul simple

Permet d’exporter les notes calculées par étudiant.

Ce fichier contient :

- numéro étudiant
- nom
- prénom
- contribution de chaque composante active
- note finale sur 20

### CSV calcul détaillé avec formules

Permet d’exporter un détail du calcul des notes.

Ce fichier explique comment chaque contribution est obtenue.

Exemples de formules exportées :

```text
0,8 × 15 = 12
(4 / 5) × 5 = 4
(16 / 20) × 10 = 8
```

Cet export permet de vérifier les calculs, d’expliquer les résultats et de conserver une trace plus transparente de la méthode utilisée.

---

## Anomalies détectées

L’application peut détecter plusieurs types de problèmes, par exemple :

- **numéro étudiant invalide**
- **étudiant absent du fichier PEGASE**
- **composante manquante**
- **colonnes attendues introuvables**

Dans certains cas, une **suggestion de numéro étudiant** peut être proposée lorsqu’un rapprochement fiable est possible avec le fichier PEGASE.

---

## Horodatage des exports

Les fichiers exportés utilisent un nom horodaté.

Exemples :

```text
PEGASE_rempli_2026-04-30_14h25.csv
anomalies_2026-04-30_14h25.csv
calcul_notes_2026-04-30_14h25.csv
detail_calcul_notes_2026-04-30_14h25.csv
```

Cela permet d’éviter d’écraser les anciens exports et de garder une trace des traitements réalisés.

---

## Technologies utilisées

Ce projet a été réalisé avec les technologies web suivantes :

- **HTML**
- **CSS**
- **JavaScript**

L’application ne nécessite :

- aucun framework externe
- aucun serveur backend
- aucune base de données
- aucune connexion Internet

Tout le traitement se fait localement dans le navigateur.

---

## Utilisation

### 1. Ouvrir l’application

Ouvrir le fichier `index.html` dans un navigateur.

### 2. Choisir le mode

Sélectionner :

- **Mode classique**
- ou **Mode libre**

### 3. Choisir la méthode de pondération

Sélectionner :

- **Points sur /20**
- ou **Coefficients**

### 4. Paramétrer les composantes

Définir :

- les composantes actives
- leurs points ou coefficients
- les options des composantes en mode libre si nécessaire

### 5. Importer les fichiers

Importer les fichiers CSV nécessaires selon les composantes choisies.

### 6. Vérifier le paramétrage

Si besoin, ajuster manuellement les colonnes reconnues par l’application.

### 7. Lancer l’analyse

Cliquer sur le bouton **Analyser**.

### 8. Consulter les résultats

Lire :

- le résumé
- l’onglet Aperçu des notes
- l’onglet Anomalies

### 9. Exporter les fichiers

Exporter les fichiers générés selon le besoin :

- PEGASE rempli
- anomalies
- calcul simple
- calcul détaillé avec formules

### 10. Sauvegarder un preset

Sauvegarder la configuration dans un fichier JSON si elle doit être réutilisée plus tard.

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

Version actuelle : **1.3.0**
