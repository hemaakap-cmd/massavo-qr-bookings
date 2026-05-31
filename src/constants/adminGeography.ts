export interface AdminGeographyLabels {
  section: string;
  states: string;
  stateSingular: string;
  counties: string;
  countySingular: string;
  cities: string;
  citySingular: string;
}

const GEO_BY_COUNTRY: Record<string, AdminGeographyLabels> = {
  DE: {
    section: "Geography",
    states: "Bundesländer",
    stateSingular: "Bundesland",
    counties: "Landkreise",
    countySingular: "Landkreis",
    cities: "Städte/Orte",
    citySingular: "Stadt/Ort",
  },
  EG: {
    section: "الجغرافيا",
    states: "المحافظات",
    stateSingular: "محافظة",
    counties: "المراكز والأحياء",
    countySingular: "مركز / حي",
    cities: "المدن",
    citySingular: "مدينة",
  },
  SA: {
    section: "الجغرافيا",
    states: "المناطق",
    stateSingular: "منطقة",
    counties: "المحافظات",
    countySingular: "محافظة",
    cities: "المدن",
    citySingular: "مدينة",
  },
};

const DEFAULT_GEO_LABELS: AdminGeographyLabels = {
  section: "Geography",
  states: "States",
  stateSingular: "State",
  counties: "Counties",
  countySingular: "County",
  cities: "Cities",
  citySingular: "City",
};

export function getAdminGeographyLabels(countryCode?: string | null): AdminGeographyLabels {
  if (!countryCode) return DEFAULT_GEO_LABELS;
  return GEO_BY_COUNTRY[countryCode] || DEFAULT_GEO_LABELS;
}
