/*
   affichage.js - Affichage des résultats
   - construit le tableau "aperçu"
   - remplit les tableaux HTML
   - applique les filtres (recherche + anomalies)
   - génère le bloc "Résumé"
 */
(function () {
  "use strict";

  const CN = window.CN;
  CN.affichage = CN.affichage || {};

  function libelleNotePegase(colNote) {
    const raw = (colNote ?? "").toString().trim();
    if (!raw) return "Note";

    const norm = CN.data.nettoyerTexte(raw);

    const m = norm.match(/NOTE[_\s-]*SESSION[_\s-]*(\d+)/);
    if (m && m[1]) return `Note session ${m[1]}`;

    if (norm.includes("NOTE")) return `Note (${raw})`;

    return raw;
  }

  function libelleModeRemplissage(mode) {
    const m = (mode ?? "").toString();

    if (m === "ecraser_systematiquement") {
      return "Écraser systématiquement";
    }
    if (m === "si_nouvelle_superieure") {
      return "Remplacer seulement si la nouvelle note est supérieure";
    }
    if (m === "si_ancienne_lt10_et_nouvelle_gt10") {
      return "Remplacer seulement si l'ancienne note est < 10 et la nouvelle > 10";
    }
    return "Ne rien écraser";
  }

  function libelleMethodeArrondi(methode) {
    const m = (methode ?? "").toString();
    if (m === "superieur") return "Arrondi au supérieur";
    if (m === "inferieur") return "Arrondi à l’inférieur";
    return "Arrondi classique";
  }

  function libellePrecisionArrondi(precision) {
    const p = (precision ?? "").toString();
    if (p === "entier") return "à l’entier";
    if (p === "dixieme") return "au dixième";
    return "au centième";
  }

  function formaterNoteBruteAffichage(valeur) {
    const n = CN.data.toNombreFR(valeur);
    if (!Number.isFinite(n)) return "";

    // enlève les zéros inutiles à la fin
    return n.toFixed(3).replace(/\.?0+$/, "").replace(".", ",");
  }

  function formaterNoteFinaleAffichage(valeur, config) {
    return CN.data.formaterNoteSelonConfig(valeur, config, ",");
  }

  /*
     Construire les données du tableau "aperçu"
     - entetes : ordre des colonnes à afficher
     - lignes  : données de chaque étudiant
     - labels  : noms des colonnes
  */
  CN.affichage.rendreTableApercu = function (pegase, mappingPegase, notes, anomaliesParId, config) {
    const avecPegase = !!(
      pegase &&
      Array.isArray(pegase.lignes) &&
      mappingPegase &&
      mappingPegase.colId &&
      mappingPegase.colNom &&
      mappingPegase.colPrenom &&
      mappingPegase.colNote
    );

    // CAS 1 : SANS PEGASE
    if (!avecPegase) {
      const entetes = ["N° étudiant", "Nom", "Prénom"];

      if (config.usePix) entetes.push("NOTE_PIX");
      if (config.usePres) entetes.push("NOTE_PRESENCES");
      if (config.useRD) entetes.push("NOTE_RD");

      entetes.push("NOTE_FINALE_20");

      const labels = {
        "N° étudiant": "N° étudiant",
        "Nom": "Nom",
        "Prénom": "Prénom",
        "NOTE_FINALE_20": "Note finale (/20)"
      };

      if (config.usePix) {
        const pts = Number.isFinite(config.ptsPix) ? config.ptsPix : 0;
        labels["NOTE_PIX"] = `Note PIX (/${pts})`;
      }
      if (config.usePres) {
        const pts = Number.isFinite(config.ptsPres) ? config.ptsPres : 0;
        labels["NOTE_PRESENCES"] = `Note présences (/${pts})`;
      }
      if (config.useRD) {
        const pts = Number.isFinite(config.ptsRD) ? config.ptsRD : 0;
        labels["NOTE_RD"] = `Note RD (/${pts})`;
      }

      const ids = Array.from(notes.keys());

      const lignes = ids.map((id) => {
        const n = notes.get(id) || null;
        const nbAno = anomaliesParId.get(id)?.length || 0;

        const base = {
          "N° étudiant": id,
          "Nom": n?.nom || "",
          "Prénom": n?.prenom || "",
          "ANOMALIES": nbAno ? String(nbAno) : ""
        };

        if (config.usePix) base["NOTE_PIX"] = formaterNoteBruteAffichage(n?.notePix);
        if (config.usePres) base["NOTE_PRESENCES"] = formaterNoteBruteAffichage(n?.notePres);
        if (config.useRD) base["NOTE_RD"] = formaterNoteBruteAffichage(n?.noteRD);

        base["NOTE_FINALE_20"] = formaterNoteFinaleAffichage(n?.noteFinale, config);

        return base;
      });

      return { entetes, lignes, labels };
    }

    // CAS 2 : AVEC PEGASE
    const entetes = [
      mappingPegase.colId,
      mappingPegase.colNom,
      mappingPegase.colPrenom,
      mappingPegase.colNote
    ];

    if (config.usePix) entetes.push("NOTE_PIX");
    if (config.usePres) entetes.push("NOTE_PRESENCES");
    if (config.useRD) entetes.push("NOTE_RD");

    entetes.push("NOTE_FINALE_20", "STATUT");

    const labels = {};
    labels[mappingPegase.colId] = "N° étudiant";
    labels[mappingPegase.colNom] = "Nom";
    labels[mappingPegase.colPrenom] = "Prénom";
    labels[mappingPegase.colNote] = libelleNotePegase(mappingPegase.colNote);

    if (config.usePix) {
      const pts = Number.isFinite(config.ptsPix) ? config.ptsPix : 0;
      labels["NOTE_PIX"] = `Note PIX (/${pts})`;
    }
    if (config.usePres) {
      const pts = Number.isFinite(config.ptsPres) ? config.ptsPres : 0;
      labels["NOTE_PRESENCES"] = `Note présences (/${pts})`;
    }
    if (config.useRD) {
      const pts = Number.isFinite(config.ptsRD) ? config.ptsRD : 0;
      labels["NOTE_RD"] = `Note RD (/${pts})`;
    }

    labels["NOTE_FINALE_20"] = "Note finale (/20)";
    labels["STATUT"] = "Statut";

    const pegById = new Map();
    for (const r of pegase.lignes) {
      const id = (r[mappingPegase.colId] ?? "").toString().trim();
      if (id && !pegById.has(id)) pegById.set(id, r);
    }

    const ids = [];
    const seen = new Set();

    for (const r of pegase.lignes) {
      const id = (r[mappingPegase.colId] ?? "").toString().trim();
      if (id && !seen.has(id)) {
        ids.push(id);
        seen.add(id);
      }
    }

    for (const id of notes.keys()) {
      if (id && !seen.has(id)) {
        ids.push(id);
        seen.add(id);
      }
    }

    const lignes = ids.map((id) => {
      const rPeg = pegById.get(id) || null;
      const n = notes.get(id) || null;
      const nbAno = anomaliesParId.get(id)?.length || 0;

      const nom = rPeg ? (rPeg[mappingPegase.colNom] ?? "") : (n?.nom || "");
      const prenom = rPeg ? (rPeg[mappingPegase.colPrenom] ?? "") : (n?.prenom || "");

      const base = {
        [mappingPegase.colId]: id,
        [mappingPegase.colNom]: nom,
        [mappingPegase.colPrenom]: prenom,
        [mappingPegase.colNote]: rPeg ? (rPeg[mappingPegase.colNote] ?? "") : "",
        STATUT: rPeg ? "PEGASE" : "Hors PEGASE",
        ANOMALIES: nbAno ? String(nbAno) : ""
      };

      if (config.usePix) base["NOTE_PIX"] = formaterNoteBruteAffichage(n?.notePix);
      if (config.usePres) base["NOTE_PRESENCES"] = formaterNoteBruteAffichage(n?.notePres);
      if (config.useRD) base["NOTE_RD"] = formaterNoteBruteAffichage(n?.noteRD);

      base["NOTE_FINALE_20"] = formaterNoteFinaleAffichage(n?.noteFinale, config);

      return base;
    });

    return { entetes, lignes, labels };
  };

  /*
     Remplir un tableau HTML
  */
  CN.affichage.remplirTableHTML = function (tableHead, tableBody, entetes, lignes, labels) {
    tableHead.innerHTML = "";
    tableBody.innerHTML = "";

    // En-têtes
    const trh = document.createElement("tr");
    for (const h of entetes) {
      const th = document.createElement("th");
      th.textContent = (labels && labels[h]) ? labels[h] : h;
      trh.appendChild(th);
    }
    tableHead.appendChild(trh);

    // Lignes
    for (const l of lignes) {
      const tr = document.createElement("tr");
      for (const h of entetes) {
        const td = document.createElement("td");
        td.textContent = (l[h] ?? "").toString();
        tr.appendChild(td);
      }
      tableBody.appendChild(tr);
    }
  };

  /*
     Filtrer le tableau "aperçu"
     - recherche texte (numéro étudiant/nom/prénom)
     - filtre anomalies (tous / avec / sans)
  */
  CN.affichage.filtrerApercu = function (apercu) {
    const q = (CN.el.recherche.value ?? "").toString().trim().toUpperCase();
    const filtre = CN.el.filtreAnomalies.value;

    const entetes = apercu.entetes;

    const lignes = apercu.lignes.filter((r) => {
      // Recherche (sur les 3 premières colonnes : numéro étudiant, nom, prénom)
      const txt = `${r[entetes[0]]} ${r[entetes[1]]} ${r[entetes[2]]}`.toUpperCase();
      const matchQ = !q || txt.includes(q);

      // Filtre anomalies
      const a = (r["ANOMALIES"] ?? "").toString().trim();
      const aOui = a !== "" && a !== "0";

      const matchA =
        filtre === "tous" ? true :
          filtre === "avec" ? aOui :
            filtre === "sans" ? !aOui :
              true;

      return matchQ && matchA;
    });

    CN.affichage.remplirTableHTML(
      CN.el.tableApercuHead,
      CN.el.tableApercuBody,
      entetes,
      lignes,
      apercu.labels
    );
  };

  /*
     Construire le bloc "Résumé"
     - stats : infos calculées dans app.js
     - config : pondérations et composantes activées
  */
  CN.affichage.construireResume = function (stats, config) {
    const wrap = document.createElement("div");
    wrap.className = "ligne";

    const comp = [];
    if (config.usePix) comp.push(`PIX=${config.ptsPix}`);
    if (config.usePres) comp.push(`Présences=${config.ptsPres}`);
    if (config.useRD) comp.push(`RD=${config.ptsRD}`);

    wrap.innerHTML = `
    <div class="alerte info" style="flex:1">
      <b>Résumé</b><br/>
      Composantes : <b>${comp.join(" ; ")}</b> (sur /20)<br/>
      Arrondi : <b>${config.arrondiActif === false ? "Désactivé (note brute)" : `${libelleMethodeArrondi(config.arrondiMethode)} ${libellePrecisionArrondi(config.arrondiPrecision)}`}</b><br/>
      ${stats.avecPegase ? `Mode PEGASE : <b>${libelleModeRemplissage(config.modeRemplissage)}</b><br/>` : ``}
      <br/>

      ${stats.avecPegase ? `PEGASE : ${stats.pegaseLignes} lignes<br/>` : ``}
      ${config.usePix ? `PIX : ${stats.pixValides} valides - invalides : ${stats.pixInvalides}<br/>` : ``}
      ${config.usePres ? `Présences : ${stats.presFichiers} fichier(s) - invalides : ${stats.presInvalides}<br/>` : ``}
      ${config.useRD ? `Recherche documentaire : ${stats.rdValides} valides - invalides : ${stats.rdInvalides}<br/>` : ``}
      <br/>
      ${stats.avecPegase ? `Écritures PEGASE : <b>${stats.nbEcrits}</b> - ignorées : ${stats.nbIgnores} - ABI : ${stats.nbABI}<br/>` : ``}
      Anomalies : <b>${stats.nbAnomalies}</b>
    </div>
  `;
    return wrap;
  };
})();