/*
 * EMO · dates de session sur les landing pages Systeme.io
 * Lit sessions.json (généré par la synchronisation Airtable) et :
 *  - remplit les textes marqués data-emo-tpl, les encarts data-emo-cartes et les blocs data-emo-si-session ;
 *  - ajoute une liste « Date de session » au-dessus du formulaire Systeme.io et recopie le choix
 *    dans le champ contact session_choisie du formulaire (iframe du même domaine).
 * Aucune date n'est écrite dans la page : sans données, les blocs affichent leur texte data-emo-vide ou sont masqués.
 *
 * Utilisation :
 * <script src=".../emo-sessions.js" data-formation="MGMT" data-feed=".../sessions.json" data-max="2" defer></script>
 */
(function () {
  'use strict';

  var script = document.currentScript || {};
  var attr = function (name, fallback) {
    return (script.getAttribute && script.getAttribute(name)) || fallback;
  };
  var CFG = {
    formation: attr('data-formation', ''),
    feed: attr('data-feed', 'sessions.json'),
    max: parseInt(attr('data-max', '99'), 10),
    champ: attr('data-champ', 'session_choisie'),
    formulaire: attr('data-formulaire', '.emo-form-embed'),
    fuseau: 'Europe/Paris'
  };

  var MOIS_ABR = ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'];

  // ---------- Dates ----------

  function aujourdhui() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: CFG.fuseau }).format(new Date());
  }
  function versDate(iso) {
    return new Date(iso + 'T12:00:00Z');
  }
  function fr(iso, options) {
    var o = { timeZone: 'UTC' };
    for (var k in options) o[k] = options[k];
    return versDate(iso).toLocaleDateString('fr-FR', o);
  }
  function dateLongue(iso) { return fr(iso, { day: 'numeric', month: 'long', year: 'numeric' }); }
  function dateSansAnnee(iso) { return fr(iso, { day: 'numeric', month: 'long' }); }
  function dateAvecJour(iso) {
    var s = fr(iso, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  function dateCourte(iso) { return iso.slice(8, 10) + '/' + iso.slice(5, 7); }

  function joindre(liste, sep, dernier) {
    if (liste.length < 2) return liste.join('');
    return liste.slice(0, -1).join(sep) + dernier + liste[liste.length - 1];
  }

  // ---------- Données ----------

  function echapper(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function remplir(tpl, vals) {
    return tpl.replace(/\{([a-z_]+)\}/g, function (m, k) {
      return Object.prototype.hasOwnProperty.call(vals, k) ? echapper(vals[k]) : m;
    });
  }

  function preparer(feed) {
    var auj = aujourdhui();
    var toutes = (feed && feed.sessions || []).filter(function (s) {
      return s.formation === CFG.formation && s.debut >= auj;
    });
    toutes.forEach(function (s) {
      s.reservable = s.statut === 'ouverte' && s.cloture >= auj;
    });
    // Affichées : réservables ou complètes (une session close n'est plus montrée)
    var affichees = toutes.filter(function (s) { return s.reservable || s.statut === 'complet'; });
    return { affichees: affichees, reservables: affichees.filter(function (s) { return s.reservable; }) };
  }

  function valeursSession(s, i) {
    return {
      i: i + 1,
      code: s.code,
      jour: String(versDate(s.debut).getUTCDate()),
      mois_abr: MOIS_ABR[versDate(s.debut).getUTCMonth()],
      date_longue: dateLongue(s.debut),
      date_avec_jour: dateAvecJour(s.debut),
      date_sans_annee: dateSansAnnee(s.debut),
      date_courte: dateCourte(s.debut),
      cloture: dateSansAnnee(s.cloture),
      cloture_longue: dateLongue(s.cloture),
      duree: s.duree || '',
      prix_ht: s.prix_ht || '',
      etat: s.statut === 'complet' ? 'Complet' : ''
    };
  }

  function valeursGlobales(affichees) {
    var visibles = affichees.slice(0, CFG.max);
    var prochaine = affichees.filter(function (s) { return s.reservable; })[0];
    var v = {
      n: visibles.length,
      pluriel: visibles.length > 1 ? 's' : '',
      courtes: joindre(visibles.map(function (s) { return dateCourte(s.debut); }), ', ', ' & '),
      longues: joindre(visibles.map(function (s) { return dateLongue(s.debut); }), ', ', ' ou '),
      longues_le: joindre(visibles.map(function (s) { return 'le ' + dateLongue(s.debut); }), ', ', ' ou ')
    };
    if (prochaine) {
      v.prochaine = dateLongue(prochaine.debut);
      v.prochaine_avec_jour = dateAvecJour(prochaine.debut);
      v.prochaine_cloture = dateLongue(prochaine.cloture);
      v.prochaine_cloture_sans_annee = dateSansAnnee(prochaine.cloture);
    }
    return v;
  }

  // ---------- Rendu des textes ----------

  function vider(el) {
    var vide = el.getAttribute('data-emo-vide');
    if (vide) el.textContent = vide;
    else el.style.display = 'none';
  }

  function rendreTextes(donnees) {
    var affichees = donnees ? donnees.affichees : [];
    var vals = valeursGlobales(affichees);

    document.querySelectorAll('[data-emo-tpl]').forEach(function (el) {
      var tpl = el.getAttribute('data-emo-tpl');
      var res = remplir(tpl, vals);
      if (!affichees.length || /\{[a-z_]+\}/.test(res)) vider(el);
      else el.innerHTML = res;
    });

    document.querySelectorAll('[data-emo-cartes]').forEach(function (box) {
      var modele = box.querySelector('template');
      if (!modele) return;
      Array.prototype.slice.call(box.children).forEach(function (c) {
        if (c !== modele) box.removeChild(c);
      });
      var visibles = affichees.slice(0, CFG.max);
      if (!visibles.length) {
        var p = document.createElement('p');
        p.className = 'emo-dates-vide';
        p.textContent = box.getAttribute('data-emo-vide') || '';
        box.appendChild(p);
        return;
      }
      visibles.forEach(function (s, i) {
        var tmp = document.createElement('div');
        tmp.innerHTML = remplir(modele.innerHTML, valeursSession(s, i));
        while (tmp.firstChild) box.appendChild(tmp.firstChild);
      });
    });

    // Blocs liés à une session (ex. offre duo) : visibles seulement tant que la session est réservable.
    // Valeur « prochaine » = la prochaine session réservable, quelle qu'elle soit.
    document.querySelectorAll('[data-emo-si-session]').forEach(function (el) {
      var code = el.getAttribute('data-emo-si-session');
      var s = donnees && (code === 'prochaine'
        ? donnees.reservables[0]
        : donnees.reservables.filter(function (x) { return x.code === code; })[0]);
      if (!s) { el.style.display = 'none'; return; }
      if (!el._emoTpl) el._emoTpl = el.innerHTML;
      el.innerHTML = remplir(el._emoTpl, valeursSession(s, 0));
      el.style.display = ''; // masqué par défaut dans la page tant que le script n'a pas confirmé la session
    });
  }

  // ---------- Formulaire ----------

  function sessionDemandee(reservables, toutes) {
    var p = new URLSearchParams(window.location.search).get('session');
    if (!p) return { choix: reservables.length === 1 ? reservables[0].code : '' };
    p = p.trim().toUpperCase();
    var match = function (s) { return s.code === p || s.debut === p; };
    var ok = reservables.filter(match)[0];
    if (ok) return { choix: ok.code };
    var connue = toutes.filter(match)[0] || (/^\d{4}-\d{2}-\d{2}$/.test(p.slice(-10)) ? { debut: p.slice(-10) } : null);
    return { choix: '', indisponible: connue ? dateLongue(connue.debut) : null };
  }

  function creerSelecteur(conteneur, donnees) {
    var bloc = document.createElement('div');
    bloc.className = 'emo-session-choix';
    bloc.innerHTML =
      '<label for="emo-session-select">Date de session <span aria-hidden="true">*</span></label>' +
      '<select id="emo-session-select" required></select>' +
      '<p class="emo-session-info"></p>' +
      '<p class="emo-session-note" role="status"></p>';
    var select = bloc.querySelector('select');
    var note = bloc.querySelector('.emo-session-note');
    var info = bloc.querySelector('.emo-session-info');

    var vide = document.createElement('option');
    vide.value = '';
    vide.textContent = 'Choisissez votre session';
    select.appendChild(vide);
    if (!donnees.reservables.length) {
      // Aucune date ouverte : la personne peut quand même laisser ses coordonnées
      var attente = document.createElement('option');
      attente.value = CFG.formation + '-A-PLANIFIER';
      attente.textContent = 'Prévenez-moi des prochaines dates';
      select.appendChild(attente);
    }
    donnees.affichees.forEach(function (s) {
      var o = document.createElement('option');
      o.value = s.code;
      o.textContent = dateAvecJour(s.debut) + (s.reservable ? '' : ' · complet');
      o.disabled = !s.reservable;
      select.appendChild(o);
    });

    var demande = sessionDemandee(donnees.reservables, donnees.affichees);
    select.value = demande.choix;
    var majInfo = function () {
      var s = donnees.reservables.filter(function (x) { return x.code === select.value; })[0];
      info.textContent = s ? 'Inscriptions jusqu’au ' + dateLongue(s.cloture) : '';
    };
    select.addEventListener('change', majInfo);
    majInfo();
    if (demande.indisponible) {
      note.textContent = 'La session du ' + demande.indisponible + ' n’est plus ouverte aux inscriptions. Choisissez une autre date.';
    }

    var style = document.createElement('style');
    style.textContent =
      '.emo-session-choix{margin:0 0 12px;text-align:left}' +
      '.emo-session-choix label{display:block;font-size:14px;font-weight:700;margin:0 0 6px;color:#1d2340}' +
      '.emo-session-choix select{width:100%;padding:12px 14px;font-size:15px;border:1px solid #d6d9e6;border-radius:10px;background:#fff;color:#1d2340}' +
      '.emo-session-choix select.emo-erreur{border-color:#d93025;box-shadow:0 0 0 3px rgba(217,48,37,.15)}' +
      '.emo-session-info{font-size:13px;margin:6px 0 0;color:#5b6280}' +
      '.emo-session-info:empty{display:none}' +
      '.emo-session-note{font-size:13px;margin:6px 0 0;color:#b3261e}' +
      '.emo-session-note:empty{display:none}';
    document.head.appendChild(style);

    conteneur.insertBefore(bloc, conteneur.firstChild);
    return { select: select, note: note };
  }

  // Écrit une valeur dans un champ géré par React (formulaire Systeme.io)
  function ecrireChamp(input, valeur) {
    var proto = Object.getPrototypeOf(input);
    var desc = Object.getOwnPropertyDescriptor(proto, 'value');
    if (desc && desc.set) desc.set.call(input, valeur);
    else input.value = valeur;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function brancherIframe(conteneur, ui) {
    var relies = [];
    function relier(iframe) {
      var doc;
      try { doc = iframe.contentDocument; } catch (e) { return false; }
      if (!doc || !doc.body) return false;
      var champ = doc.querySelector('[name="' + CFG.champ + '"]');
      if (!champ) return false;
      if (relies.indexOf(iframe) >= 0) return true;
      relies.push(iframe);

      // Le champ texte Systeme.io reste dans le formulaire mais la liste ci-dessus le remplace visuellement
      var cadre = champ.parentElement;
      while (cadre && cadre.parentElement && cadre.parentElement.querySelectorAll('input, textarea, select').length === 1) {
        cadre = cadre.parentElement;
      }
      (cadre || champ).style.display = 'none';

      var synchro = function () { ecrireChamp(champ, ui.select.value); };
      ui.select.addEventListener('change', function () {
        ui.select.classList.remove('emo-erreur');
        ui.note.textContent = '';
        synchro();
      });
      synchro();

      // Bloque l'envoi tant qu'aucune session n'est choisie
      doc.addEventListener('click', function (e) {
        var bouton = e.target.closest && e.target.closest('button, [type="submit"]');
        if (!bouton || ui.select.value) { if (bouton) synchro(); return; }
        e.preventDefault();
        e.stopPropagation();
        ui.select.classList.add('emo-erreur');
        ui.note.textContent = 'Merci de choisir une date de session.';
        ui.select.scrollIntoView({ behavior: 'smooth', block: 'center' });
        ui.select.focus();
      }, true);
      return true;
    }

    var essais = 0;
    var timer = setInterval(function () {
      var iframes = conteneur.querySelectorAll('iframe');
      var ok = false;
      iframes.forEach(function (f) { if (relier(f)) ok = true; });
      if (ok || ++essais > 60) {
        clearInterval(timer);
        if (!ok && window.console) console.warn('[EMO] champ ' + CFG.champ + ' introuvable dans le formulaire Systeme.io');
      }
    }, 500);
  }

  function rendreFormulaire(donnees) {
    var conteneur = document.querySelector(CFG.formulaire);
    if (!conteneur || conteneur._emoSession) return;
    conteneur._emoSession = true;
    brancherIframe(conteneur, creerSelecteur(conteneur, donnees));
  }

  // ---------- Démarrage ----------

  function demarrer(feed) {
    var donnees = feed ? preparer(feed) : null;
    rendreTextes(donnees);
    // Données injoignables : on laisse le champ texte Systeme.io visible pour ne bloquer aucune inscription
    if (donnees) rendreFormulaire(donnees);
  }

  function charger() {
    if (!window.fetch) return demarrer(null);
    fetch(CFG.feed, { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(demarrer)
      .catch(function (e) {
        if (window.console) console.warn('[EMO] sessions indisponibles', e);
        demarrer(null);
      });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', charger);
  else charger();
})();
