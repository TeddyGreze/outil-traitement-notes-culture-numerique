/*
   csv.js - Outils “données” + lecture/écriture CSV
   - CN.data : fonctions (nombres, nettoyage texte, validation ID)
   - CN.csv  : lecture fichier, parsing CSV, recherche colonnes, export CSV
*/
(function () {
  "use strict";
  const CN = window.CN;

  CN.data = CN.data || {};
  CN.csv = CN.csv || {};

  // Arrondi à 2 décimales
  CN.data.arrondi2 = function (x) {
    return Math.round((x + Number.EPSILON) * 100) / 100;
  };

  // Normalise un texte pour comparer facilement des en-têtes
  // (majuscules, sans accents, sans espaces autour)
  CN.data.nettoyerTexte = function (s) {
    return (s ?? "")
      .toString()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toUpperCase();
  };

  // Vérifie un numéro étudiant : exactement 8 chiffres
  CN.data.estNumeroEtudiantValide = function (s) {
    return /^[0-9]{8}$/.test((s ?? "").toString().trim());
  };

  // Convertit une valeur “FR” en nombre :
  // - accepte virgule ou point
  // - enlève les espaces
  // - renvoie NaN si invalide
  CN.data.toNombreFR = function (val) {
    if (val === null || val === undefined) return NaN;
    const s = val.toString().trim().replace(/\s/g, "");
    if (!s) return NaN;
    const norm = s.replace(",", ".");
    const n = Number(norm);
    return Number.isFinite(n) ? n : NaN;
  };

  // Lecture et parsing CSV

  // Devine le séparateur à partir de la ligne d’en-tête
  // (on prend celui qui apparaît le plus)
  CN.csv.detecterDelimiteur = function (enteteLigne) {
    const candidats = [";", ",", "\t"];
    let best = ";";
    let bestCount = -1;
    for (const c of candidats) {
      const count = enteteLigne.split(c).length - 1;
      if (count > bestCount) {
        bestCount = count;
        best = c;
      }
    }
    return best;
  };

  // Lit un fichier local en UTF-8
  CN.csv.lireFichierTexte = async function (file) {
    const buf = await file.arrayBuffer();
    let txt = new TextDecoder("utf-8").decode(buf);
    if (txt.charCodeAt(0) === 0xFEFF) txt = txt.slice(1);
    return txt;
  };

  // Parse un CSV en tableau de lignes
  // Retour : tableau de tableaux (première ligne = en-têtes)
  CN.csv.parserCSV = function (texte, delimiteur) {
    const lignes = [];
    let ligne = [];
    let champ = "";
    let dansGuillemets = false;

    for (let i = 0; i < texte.length; i++) {
      const ch = texte[i];

      if (dansGuillemets) {
        if (ch === '"') {
          const next = texte[i + 1];
          if (next === '"') {
            champ += '"';
            i++;
          } else {
            dansGuillemets = false;
          }
        } else {
          champ += ch;
        }
      } else {
        if (ch === '"') {
          dansGuillemets = true;
        } else if (ch === delimiteur) {
          ligne.push(champ);
          champ = "";
        } else if (ch === "\n") {
          ligne.push(champ.replace(/\r$/, ""));
          lignes.push(ligne);
          ligne = [];
          champ = "";
        } else {
          champ += ch;
        }
      }
    }
    ligne.push(champ.replace(/\r$/, ""));
    lignes.push(ligne);

    // Supprime les lignes vides
    return lignes.filter(r => r.some(v => (v ?? "").toString().trim() !== ""));
  };

  // Transforme un tableau CSV en objets
  CN.csv.tableauVersObjets = function (tab) {
    const entetes = tab[0].map(h => (h ?? "").toString().trim());
    const out = [];
    for (let i = 1; i < tab.length; i++) {
      const row = tab[i];
      const obj = {};
      for (let c = 0; c < entetes.length; c++) obj[entetes[c]] = row[c] ?? "";
      out.push(obj);
    }
    return { entetes, lignes: out };
  };

  // Trouve une colonne dans des en-têtes à partir d’une liste de noms possibles
  // 1) match exact
  // 2) sinon match “contient”
  CN.csv.trouverColonne = function (entetes, candidats) {
    const entN = entetes.map(CN.data.nettoyerTexte);
    for (const c of candidats) {
      const idx = entN.indexOf(CN.data.nettoyerTexte(c));
      if (idx !== -1) return entetes[idx];
    }
    for (let i = 0; i < entetes.length; i++) {
      const n = CN.data.nettoyerTexte(entetes[i]);
      for (const c of candidats) {
        if (n.includes(CN.data.nettoyerTexte(c))) return entetes[i];
      }
    }
    return null;
  };

  // Génération + téléchargement CSV

  CN.csv.echapperCSV = function (v, delim) {
    const s = (v ?? "").toString();
    if (s.includes('"') || s.includes("\n") || s.includes("\r") || s.includes(delim)) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  // Génère un CSV à partir d’entêtes + objets ligne
  CN.csv.genererCSV = function (entetes, lignes, delim) {
    const out = [];
    out.push(entetes.map(h => CN.csv.echapperCSV(h, delim)).join(delim));
    for (const r of lignes) out.push(entetes.map(h => CN.csv.echapperCSV(r[h] ?? "", delim)).join(delim));
    return "\ufeff" + out.join("\n");
  };

  // Déclenche le téléchargement d’un contenu texte (CSV)
  CN.csv.telechargerTexte = function (nomFichier, contenu, mime = "text/csv;charset=utf-8") {
    const blob = new Blob([contenu], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nomFichier;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };
})();