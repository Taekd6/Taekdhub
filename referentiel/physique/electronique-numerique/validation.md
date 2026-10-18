# Validation : Électronique numérique (préfixe en)

- Cartes : 22. Origines : {'nouvelle': 6, 'réécrite': 14, 'scindée de la note 1790858881729': 2}.
- Notes d'origine du lot : toutes présentes dans `anciennes` (aucune écartée).
- Sources lues : PROGRAMME-PC-MP-2021, ISM-PC-TS-1, ISM-PC-TS-2, PC-LAFAYETTE-ELEC-CHE1, PC-LAFAYETTE-ELEC-TP1, PC-LAFAYETTE-ELEC-TP2, PC-LAFAYETTE-ELEC-QC, PC-LAFAYETTE-ELEC-ODG (enregistrées dans referentiel/sources/electronique.json ; les deux premières déjà dans physique-base.json).
- Exigibilité : Programme MP §2.2 : partie uniquement expérimentale (échantillonnage, repliement, CAN/CNA, filtrage numérique) : confirmé. Détection synchrone et modulation d'amplitude : non cités, à confirmer / hors programme.
- Aucune erreur de fond. Corrections : Shannon en inégalité stricte ; carte « moyenne glissante / intégrateur (Euler) » mal titrée (contenu = passe-bas d'Euler + dérivateur), scindée en 3 cartes ; versos tronqués (1790858881751, 881753, 881755) reconstruits. Stabilité d'Euler recalculée : ω_c·Te < 2. Note 1790858881735 déplacée dans signaux-filtrage.
- Exactitude « vérifiée par raisonnement » : formules recalculées (dimension, cas limites, calculs de gains et de seuils). Ordres de grandeur d'ALI (±15 V, 13,5 V, 20 mA, 13 V/µs) non recontrôlés sur une source lue : à confirmer.
- Ne pas dire « conforme au BO » : la copie n'est pas comparée au BO.
