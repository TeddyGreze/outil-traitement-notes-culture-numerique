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

  // Arrondi classique au centième
  CN.data.arrondi2 = function (x) {
    return CN.data.arrondirSelonConfig(x, "centieme", "classique");
  };

  CN.data.normaliserPrecisionArrondi = function (precision) {
    const p = (precision ?? "").toString().trim().toLowerCase();
    return ["centieme", "dixieme", "entier"].includes(p) ? p : "centieme";
  };

  CN.data.normaliserMethodeArrondi = function (methode) {
    const m = (methode ?? "").toString().trim().toLowerCase();
    return ["classique", "superieur", "inferieur"].includes(m) ? m : "classique";
  };

  CN.data.nbDecimalesPrecision = function (precision) {
    const p = CN.data.normaliserPrecisionArrondi(precision);
    if (p === "entier") return 0;
    if (p === "dixieme") return 1;
    return 2;
  };

  CN.data.facteurPrecision = function (precision) {
    const p = CN.data.normaliserPrecisionArrondi(precision);
    if (p === "entier") return 1;
    if (p === "dixieme") return 10;
    return 100;
  };

  CN.data.arrondirSelonConfig = function (valeur, precision, methode) {
    const n = CN.data.toNombreFR(valeur);
    if (!Number.isFinite(n)) return NaN;

    const facteur = CN.data.facteurPrecision(precision);
    const m = CN.data.normaliserMethodeArrondi(methode);

    if (m === "superieur") {
      return Math.ceil((n - Number.EPSILON) * facteur) / facteur;
    }

    if (m === "inferieur") {
      return Math.floor((n + Number.EPSILON) * facteur) / facteur;
    }

    return Math.round((n + Number.EPSILON) * facteur) / facteur;
  };

  CN.data.formaterNombreBrut = function (valeur, separateurDecimal = ".") {
    const n = CN.data.toNombreFR(valeur);
    if (!Number.isFinite(n)) return "";

    let s = n.toFixed(3).replace(/\.?0+$/, "");
    if (separateurDecimal === ",") s = s.replace(".", ",");

    return s;
  };

  CN.data.formaterNoteSelonConfig = function (valeur, config, separateurDecimal = ".") {
    if (config?.arrondiActif === false) {
      return CN.data.formaterNombreBrut(valeur, separateurDecimal);
    }

    const arrondie = CN.data.arrondirSelonConfig(
      valeur,
      config?.arrondiPrecision,
      config?.arrondiMethode
    );

    if (!Number.isFinite(arrondie)) return "";

    const nbDec = CN.data.nbDecimalesPrecision(config?.arrondiPrecision);
    let s = arrondie.toFixed(nbDec);

    if (separateurDecimal === ",") s = s.replace(".", ",");
    return s;
  };

  // Normalise un texte pour comparer facilement des en-têtes
  // (majuscules, sans accents, sans espaces autour)
  CN.data.nettoyerTexte = function (s) {
    return (s ?? "")
      .toString()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[_\-\/()]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase();
  };

  // Découpe un texte normalisé en mots
  CN.data.tokeniserTexte = function (s) {
    const n = CN.data.nettoyerTexte(s);
    return n ? n.split(" ") : [];
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

  CN.csv.lireFichierTexte = async function (file) {
    const buf = await file.arrayBuffer();

    function nettoyerBOM(txt) {
      return (txt && txt.charCodeAt(0) === 0xFEFF) ? txt.slice(1) : txt;
    }

    // On essaie d'abord en UTF-8 strict
    try {
      const txtUtf8 = new TextDecoder("utf-8", { fatal: true }).decode(buf);
      return nettoyerBOM(txtUtf8);
    } catch (_) {
      // si échec, on tente d'autres encodages
    }

    // Fallback fréquent pour des CSV générés par Excel / anciens exports
    try {
      const txt1252 = new TextDecoder("windows-1252").decode(buf);
      return nettoyerBOM(txt1252);
    } catch (_) {
      // on continue
    }

    // Fallback supplémentaire possible côté macOS
    try {
      const txtMac = new TextDecoder("macintosh").decode(buf);
      return nettoyerBOM(txtMac);
    } catch (_) {
      // dernier secours
    }

    // Dernier recours
    let txt = new TextDecoder("utf-8").decode(buf);
    return nettoyerBOM(txt);
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

  // Analyse du contenu d’une colonne
  // Sert à améliorer la détection quand l’intitulé n’est pas très clair
  CN.csv.analyserColonne = function (lignes, entete, maxLignes = 30) {
    const stats = {
      nbValeurs: 0,
      nbNumeriques: 0,
      nbIdsValides: 0,
      nbDigits: 0,
      nbOuiNon: 0,
      nb0a1: 0,
      nb0a5: 0,
      nb0a20: 0,
      nb0a100: 0
    };

    if (!Array.isArray(lignes) || !entete) return stats;

    for (let i = 0; i < lignes.length && stats.nbValeurs < maxLignes; i++) {
      const v = (lignes[i]?.[entete] ?? "").toString().trim();
      if (!v) continue;

      stats.nbValeurs++;

      const norm = CN.data.nettoyerTexte(v);
      const n = CN.data.toNombreFR(v);

      if (CN.data.estNumeroEtudiantValide(v)) stats.nbIdsValides++;
      if (/^[0-9]{6,10}$/.test(v)) stats.nbDigits++;
      if (norm === "OUI" || norm === "NON" || norm === "O" || norm === "N") stats.nbOuiNon++;

      if (Number.isFinite(n)) {
        stats.nbNumeriques++;
        if (n >= 0 && n <= 1) stats.nb0a1++;
        if (n >= 0 && n <= 5) stats.nb0a5++;
        if (n >= 0 && n <= 20) stats.nb0a20++;
        if (n >= 0 && n <= 100) stats.nb0a100++;
      }
    }

    return stats;
  };

  // Trouve une colonne dans des en-têtes à partir d’une liste de noms possibles
  // 1) match exact
  // 2) sinon match “contient”
  // 3) sinon score léger sur les mots
  // 4) si on a les lignes, on regarde le contenu
  CN.csv.trouverColonne = function (entetes, candidats, lignes, options = {}) {
    const excludes = options.exclude instanceof Set
      ? options.exclude
      : new Set(options.exclude || []);

    const entetesUtiles = (entetes || []).filter(h => h && !excludes.has(h));
    const entN = entetesUtiles.map(CN.data.nettoyerTexte);

    // 1) match exact
    for (const c of candidats) {
      const idx = entN.indexOf(CN.data.nettoyerTexte(c));
      if (idx !== -1) return entetesUtiles[idx];
    }

    // 2) match “contient”
    for (let i = 0; i < entetesUtiles.length; i++) {
      const n = CN.data.nettoyerTexte(entetesUtiles[i]);
      for (const c of candidats) {
        if (n.includes(CN.data.nettoyerTexte(c))) return entetesUtiles[i];
      }
    }

    // 3) score sur les mots des intitulés
    let bestCol = null;
    let bestScore = -1;

    for (const h of entetesUtiles) {
      const tokensH = CN.data.tokeniserTexte(h);
      let score = 0;

      for (const c of candidats) {
        const tokensC = CN.data.tokeniserTexte(c);
        if (!tokensC.length) continue;

        let communs = 0;
        for (const t of tokensC) {
          if (tokensH.includes(t)) communs++;
        }

        if (communs > 0) {
          const s = (communs / tokensC.length) * 100;
          if (s > score) score = s;
        }
      }

      // 4) bonus selon le contenu de la colonne
      if (Array.isArray(lignes) && lignes.length) {
        const stats = CN.csv.analyserColonne(lignes, h);
        const cible = CN.data.nettoyerTexte(candidats.join(" "));

        if (cible.includes("ETUDIANT") || cible.includes("APPRENANT")) {
          score += stats.nbIdsValides * 8 + stats.nbDigits * 2;
        }

        if (cible.includes("PARTAGE")) {
          score += stats.nbOuiNon * 6;
        }

        if (cible.includes("PROGRESSION")) {
          score += stats.nb0a1 * 4 + stats.nb0a100 * 2;
        }

        if (cible.includes("MAITRISE")) {
          score += stats.nb0a1 * 5;
        }

        if (cible.includes("/5") || cible.includes("SCORE 5") || cible.includes("NOTE 5")) {
          score += stats.nb0a5 * 4;
        }

        if (cible.includes("/20") || cible.includes("NOTE 20") || cible.includes("NOTE")) {
          score += stats.nb0a20 * 2;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestCol = h;
      }
    }

    return bestScore >= 50 ? bestCol : null;
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