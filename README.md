# Culture Numérique - Outil de traitement automatisé des notes

## Description

Cette application web locale permet de traiter automatiquement les notes de l'UE Culture Numérique à partir de plusieurs fichiers CSV.

L'objectif est de faciliter la fusion, le calcul et le contrôle des notes issues de différentes sources, tout en restant simple à utiliser. L'application fonctionne entièrement en local dans le navigateur, sans serveur et sans connexion Internet.

Elle permet de travailler avec les fichiers suivants :
- PEGASE
- PIX
- Présences
- Recherche documentaire

## Objectif du projet

Ce projet a été conçu pour automatiser une tâche qui serait longue et répétitive à faire manuellement :
- importer plusieurs fichiers CSV
- récupérer les informations utiles de chaque source
- calculer une note finale sur 20 selon des pondérations choisies
- remplir automatiquement le fichier PEGASE
- signaler les anomalies détectées
- exporter les résultats dans des fichiers CSV

## Fonctionnalités principales

- Paramétrage des composantes prises en compte :
  - PIX
  - Présences
  - Recherche documentaire
- Définition des pondérations sur 20
- Import de fichiers CSV par sélection ou glisser-déposer
- Détection automatique de certaines colonnes
- Paramétrage manuel des colonnes si nécessaire
- Analyse des données importées
- Calcul automatique des notes finales
- Remplissage du fichier PEGASE
- Détection et affichage des anomalies
- Export des résultats en CSV

## Technologies utilisées

Ce projet a été réalisé avec les technologies web suivants :
- HTML
- CSS
- JavaScript

## Utilisation

### 1. Ouvrir l'application

Ouvrir le fichier `index.html` dans un navigateur.

### 2. Paramétrer les composantes

Choisir les composantes à prendre en compte :
- PIX
- Présences
- Recherche documentaire

Puis définir leur pondération sur 20.

### 3. Importer les fichiers

Importer les fichiers CSV nécessaires selon les composantes activées.

### 4. Lancer l'analyse

Cliquer sur le bouton **Analyser**.

### 5. Consulter les résultats

L'application affiche :
- un résumé de l'analyse
- un tableau principal
- un tableau des anomalies

### 6. Exporter

L'utilisateur peut ensuite exporter les fichiers générés.

## Exports disponibles

### CSV PEGASE rempli

Permet d'obtenir le fichier PEGASE avec la colonne de note remplie automatiquement.

### CSV anomalies

Permet d'exporter toutes les anomalies détectées, ou seulement certains types d'anomalies.

### CSV calcul

Permet d'exporter les notes calculées par étudiant.

## Anomalies détectées

L'application peut détecter plusieurs types de problèmes, par exemple :
- numéro étudiant invalide
- étudiant absent du fichier PEGASE
- composante manquante

## Auteur

Projet réalisé par **Teddy GREZE**.

## Version

Version actuelle : **1.1.0**
