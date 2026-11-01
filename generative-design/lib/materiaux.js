// GENERE par app/materiaux.py depuis app/materiaux.json : ne pas editer a la main.
// schema gds-materiaux-v1, date 2026-10-22. Regenerer : python3 app/materiaux.py --generer-js
export const SOURCE = 'materiaux.json';
export const MATERIAUX = {
 "PLA": {
  "nom": "PLA",
  "famille": "polymere",
  "procedes": [
   "fdm"
  ],
  "imprime": true,
  "densite_g_cm3": 1.24,
  "rho_kg_m3": 1240,
  "E_GPa": 3.5,
  "tensile_MPa": 55,
  "yield_MPa": null,
  "fragile": true,
  "Tg_C": 60,
  "max_service_C": 55,
  "buse_C": 210,
  "plateau_C": 60,
  "prix_eur_kg": 22,
  "retrait_pct": 0.2,
  "tolerances_mm": {
   "rotating_clearance": 0.2,
   "loose_fit": 0.4,
   "press_fit": 0.05,
   "bore_compensation_vertical": 0.3,
   "bore_compensation_horizontal": 0.4
  },
  "warping_risk": "low",
  "electrical_insulator": true,
  "max_LED_W": 7,
  "lamp_wall_min_mm": 12,
  "uv": 1,
  "structure": {
   "fab": "impression 3D",
   "familles": [
    "plaque",
    "caisson"
   ]
  }
 },
 "PLA_T": {
  "nom": "PLA translucide",
  "famille": "polymere",
  "procedes": [
   "fdm"
  ],
  "imprime": true,
  "densite_g_cm3": 1.24,
  "rho_kg_m3": 1240,
  "E_GPa": 3.5,
  "tensile_MPa": 55,
  "yield_MPa": null,
  "fragile": true,
  "Tg_C": 60,
  "max_service_C": 55,
  "buse_C": 210,
  "plateau_C": 60,
  "prix_eur_kg": 26,
  "retrait_pct": 0.2,
  "tolerances_mm": {
   "rotating_clearance": 0.2,
   "loose_fit": 0.4,
   "press_fit": 0.05,
   "bore_compensation_vertical": 0.3,
   "bore_compensation_horizontal": 0.4
  },
  "warping_risk": "low",
  "electrical_insulator": true,
  "max_LED_W": 7,
  "lamp_wall_min_mm": 12,
  "uv": 1,
  "structure": {
   "fab": "impression 3D",
   "familles": [
    "plaque",
    "caisson"
   ]
  }
 },
 "PETG": {
  "nom": "PETG",
  "famille": "polymere",
  "procedes": [
   "fdm"
  ],
  "imprime": true,
  "densite_g_cm3": 1.27,
  "rho_kg_m3": 1270,
  "E_GPa": 2.1,
  "tensile_MPa": 48,
  "yield_MPa": 45,
  "fragile": false,
  "Tg_C": 80,
  "max_service_C": 75,
  "buse_C": 240,
  "plateau_C": 80,
  "prix_eur_kg": 24,
  "retrait_pct": 0.3,
  "tolerances_mm": {
   "rotating_clearance": 0.25,
   "loose_fit": 0.5,
   "press_fit": 0.1,
   "bore_compensation_vertical": 0.3,
   "bore_compensation_horizontal": 0.45
  },
  "warping_risk": "low",
  "electrical_insulator": true,
  "max_LED_W": 7,
  "lamp_wall_min_mm": 12,
  "uv": 2,
  "structure": {
   "fab": "impression 3D",
   "familles": [
    "plaque",
    "caisson"
   ]
  }
 },
 "ABS": {
  "nom": "ABS",
  "famille": "polymere",
  "procedes": [
   "fdm",
   "injection"
  ],
  "imprime": true,
  "densite_g_cm3": 1.04,
  "rho_kg_m3": 1040,
  "E_GPa": 2.2,
  "tensile_MPa": 40,
  "yield_MPa": null,
  "fragile": false,
  "Tg_C": 105,
  "max_service_C": 90,
  "buse_C": 250,
  "plateau_C": 100,
  "prix_eur_kg": 24,
  "retrait_pct": 0.6,
  "tolerances_mm": {
   "rotating_clearance": 0.25,
   "loose_fit": 0.55,
   "press_fit": 0.1,
   "bore_compensation_vertical": 0.35,
   "bore_compensation_horizontal": 0.5
  },
  "warping_risk": "high",
  "electrical_insulator": true,
  "max_LED_W": 20,
  "lamp_wall_min_mm": 8,
  "uv": 2,
  "structure": {
   "fab": "impression 3D",
   "familles": [
    "plaque",
    "caisson"
   ]
  }
 },
 "ASA": {
  "nom": "ASA (UV/exterieur)",
  "famille": "polymere",
  "procedes": [
   "fdm"
  ],
  "imprime": true,
  "densite_g_cm3": 1.07,
  "rho_kg_m3": 1070,
  "E_GPa": 2.0,
  "tensile_MPa": 40,
  "yield_MPa": null,
  "fragile": false,
  "Tg_C": 100,
  "max_service_C": 90,
  "buse_C": 255,
  "plateau_C": 100,
  "prix_eur_kg": 30,
  "retrait_pct": 0.5,
  "tolerances_mm": {
   "rotating_clearance": 0.25,
   "loose_fit": 0.55,
   "press_fit": 0.1,
   "bore_compensation_vertical": 0.35,
   "bore_compensation_horizontal": 0.5
  },
  "warping_risk": "medium",
  "electrical_insulator": true,
  "max_LED_W": 20,
  "lamp_wall_min_mm": 8,
  "uv": 4,
  "structure": {
   "fab": "impression 3D",
   "familles": [
    "plaque",
    "caisson"
   ]
  }
 },
 "TPU": {
  "nom": "TPU (souple)",
  "famille": "elastomere",
  "procedes": [
   "fdm"
  ],
  "imprime": true,
  "densite_g_cm3": 1.21,
  "rho_kg_m3": 1210,
  "E_GPa": 0.05,
  "tensile_MPa": 35,
  "yield_MPa": null,
  "fragile": false,
  "Tg_C": -40,
  "max_service_C": 80,
  "buse_C": 230,
  "plateau_C": 50,
  "prix_eur_kg": 35,
  "retrait_pct": 0.5,
  "tolerances_mm": {
   "rotating_clearance": 0.1,
   "loose_fit": 0.3,
   "press_fit": 0.0,
   "bore_compensation_vertical": 0.4,
   "bore_compensation_horizontal": 0.55
  },
  "warping_risk": "low",
  "electrical_insulator": true,
  "max_LED_W": 7,
  "lamp_wall_min_mm": 15,
  "uv": 2,
  "structure": {
   "fab": "impression 3D",
   "familles": []
  }
 },
 "PA12_CF": {
  "nom": "PA12-CF imprime",
  "famille": "polymere-charge",
  "procedes": [
   "fdm",
   "sls"
  ],
  "imprime": true,
  "densite_g_cm3": 1.15,
  "rho_kg_m3": 1150,
  "E_GPa": 5.5,
  "tensile_MPa": 85,
  "yield_MPa": null,
  "fragile": true,
  "Tg_C": 50,
  "max_service_C": 110,
  "buse_C": 280,
  "plateau_C": 80,
  "prix_eur_kg": 90,
  "retrait_pct": 0.8,
  "tolerances_mm": null,
  "warping_risk": "medium",
  "electrical_insulator": true,
  "max_LED_W": null,
  "lamp_wall_min_mm": null,
  "uv": 3,
  "structure": {
   "fab": "impression 3D",
   "familles": [
    "plaque",
    "caisson"
   ]
  }
 },
 "carbone_plaque": {
  "nom": "Carbone plaque 3K (quasi-iso)",
  "famille": "composite",
  "procedes": [
   "decoupe_cnc"
  ],
  "imprime": false,
  "densite_g_cm3": 1.55,
  "rho_kg_m3": 1550,
  "E_GPa": 55,
  "tensile_MPa": 570,
  "yield_MPa": null,
  "fragile": true,
  "Tg_C": null,
  "max_service_C": 120,
  "buse_C": null,
  "plateau_C": null,
  "prix_eur_kg": null,
  "retrait_pct": null,
  "tolerances_mm": null,
  "warping_risk": null,
  "electrical_insulator": false,
  "max_LED_W": null,
  "lamp_wall_min_mm": null,
  "uv": 4,
  "structure": {
   "fab": "decoupe CNC",
   "familles": [
    "plaque"
   ]
  }
 },
 "carbone_tube": {
  "nom": "Tube carbone roule",
  "famille": "composite",
  "procedes": [
   "tube_du_commerce"
  ],
  "imprime": false,
  "densite_g_cm3": 1.58,
  "rho_kg_m3": 1580,
  "E_GPa": 90,
  "tensile_MPa": 800,
  "yield_MPa": null,
  "fragile": true,
  "Tg_C": null,
  "max_service_C": 120,
  "buse_C": null,
  "plateau_C": null,
  "prix_eur_kg": null,
  "retrait_pct": null,
  "tolerances_mm": null,
  "warping_risk": null,
  "electrical_insulator": false,
  "max_LED_W": null,
  "lamp_wall_min_mm": null,
  "uv": 4,
  "structure": {
   "fab": "tube du commerce",
   "familles": [
    "tube"
   ]
  }
 },
 "alu_6061": {
  "nom": "Aluminium 6061-T6",
  "famille": "metal",
  "procedes": [
   "usinage",
   "tube_du_commerce"
  ],
  "imprime": false,
  "densite_g_cm3": 2.7,
  "rho_kg_m3": 2700,
  "E_GPa": 69,
  "tensile_MPa": 310,
  "yield_MPa": 276,
  "fragile": false,
  "Tg_C": null,
  "max_service_C": 150,
  "buse_C": null,
  "plateau_C": null,
  "prix_eur_kg": null,
  "retrait_pct": null,
  "tolerances_mm": null,
  "warping_risk": null,
  "electrical_insulator": false,
  "max_LED_W": null,
  "lamp_wall_min_mm": null,
  "uv": 5,
  "structure": {
   "fab": "usinage / tube",
   "familles": [
    "plaque",
    "tube"
   ]
  }
 },
 "fibre_verre": {
  "nom": "Tube fibre de verre",
  "famille": "composite",
  "procedes": [
   "tube_du_commerce"
  ],
  "imprime": false,
  "densite_g_cm3": 1.9,
  "rho_kg_m3": 1900,
  "E_GPa": 30,
  "tensile_MPa": 500,
  "yield_MPa": null,
  "fragile": true,
  "Tg_C": null,
  "max_service_C": 120,
  "buse_C": null,
  "plateau_C": null,
  "prix_eur_kg": null,
  "retrait_pct": null,
  "tolerances_mm": null,
  "warping_risk": null,
  "electrical_insulator": true,
  "max_LED_W": null,
  "lamp_wall_min_mm": null,
  "uv": 3,
  "structure": {
   "fab": "tube du commerce",
   "familles": [
    "tube"
   ]
  }
 },
 "contreplaque": {
  "nom": "Contreplaque bouleau",
  "famille": "bois",
  "procedes": [
   "decoupe_laser"
  ],
  "imprime": false,
  "densite_g_cm3": 0.68,
  "rho_kg_m3": 680,
  "E_GPa": 9,
  "tensile_MPa": 60,
  "yield_MPa": null,
  "fragile": true,
  "Tg_C": null,
  "max_service_C": 80,
  "buse_C": null,
  "plateau_C": null,
  "prix_eur_kg": null,
  "retrait_pct": null,
  "tolerances_mm": null,
  "warping_risk": null,
  "electrical_insulator": true,
  "max_LED_W": null,
  "lamp_wall_min_mm": null,
  "uv": 2,
  "structure": {
   "fab": "decoupe laser",
   "familles": [
    "plaque"
   ]
  }
 }
};
export const IMPRIMABLES = Object.fromEntries(Object.entries(MATERIAUX).filter(([, m]) => m.imprime));
export default MATERIAUX;
