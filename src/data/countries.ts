// ─────────────────────────────────────────────────────────────
// 195 Countries with Timezones (Adapted from SOS Project)
// ─────────────────────────────────────────────────────────────

export interface CountryData {
  code: string; // ISO 3166-1 alpha-2
  nameEn: string;
  nameFr: string;
  flag: string;
  phoneCode: string;
  region: string;
  timezone: string; // IANA timezone identifier (e.g., "Europe/Paris")
  utcOffset: string; // UTC offset (e.g., "+01:00")
  priority?: number;
}

/**
 * 195 countries with timezone information for smart campaign scheduling.
 *
 * Timezone selection logic:
 * - Countries with multiple timezones use the capital/most populous city
 * - For large countries (US, Russia, Canada), use the most populated timezone
 * - UTC offsets are standard time (not DST-adjusted)
 */
export const countries: CountryData[] = [
  // ========================================
  // 🏆 TOP 6 PRIORITAIRES
  // ========================================
  { code: "GB", nameEn: "United Kingdom", nameFr: "Royaume-Uni", flag: "🇬🇧", phoneCode: "+44", region: "Europe", timezone: "Europe/London", utcOffset: "+00:00", priority: 1 },
  { code: "FR", nameEn: "France", nameFr: "France", flag: "🇫🇷", phoneCode: "+33", region: "Europe", timezone: "Europe/Paris", utcOffset: "+01:00", priority: 1 },
  { code: "DE", nameEn: "Germany", nameFr: "Allemagne", flag: "🇩🇪", phoneCode: "+49", region: "Europe", timezone: "Europe/Berlin", utcOffset: "+01:00", priority: 1 },
  { code: "ES", nameEn: "Spain", nameFr: "Espagne", flag: "🇪🇸", phoneCode: "+34", region: "Europe", timezone: "Europe/Madrid", utcOffset: "+01:00", priority: 1 },
  { code: "RU", nameEn: "Russia", nameFr: "Russie", flag: "🇷🇺", phoneCode: "+7", region: "Europe", timezone: "Europe/Moscow", utcOffset: "+03:00", priority: 1 },
  { code: "CN", nameEn: "China", nameFr: "Chine", flag: "🇨🇳", phoneCode: "+86", region: "Asia", timezone: "Asia/Shanghai", utcOffset: "+08:00", priority: 1 },

  // ========================================
  // 🌍 TOUS LES AUTRES PAYS (A→Z)
  // ========================================
  { code: "AF", nameEn: "Afghanistan", nameFr: "Afghanistan", flag: "🇦🇫", phoneCode: "+93", region: "Asia", timezone: "Asia/Kabul", utcOffset: "+04:30", priority: 3 },
  { code: "AL", nameEn: "Albania", nameFr: "Albanie", flag: "🇦🇱", phoneCode: "+355", region: "Europe", timezone: "Europe/Tirane", utcOffset: "+01:00", priority: 3 },
  { code: "DZ", nameEn: "Algeria", nameFr: "Algérie", flag: "🇩🇿", phoneCode: "+213", region: "Africa", timezone: "Africa/Algiers", utcOffset: "+01:00", priority: 3 },
  { code: "AD", nameEn: "Andorra", nameFr: "Andorre", flag: "🇦🇩", phoneCode: "+376", region: "Europe", timezone: "Europe/Andorra", utcOffset: "+01:00", priority: 3 },
  { code: "AO", nameEn: "Angola", nameFr: "Angola", flag: "🇦🇴", phoneCode: "+244", region: "Africa", timezone: "Africa/Luanda", utcOffset: "+01:00", priority: 3 },
  { code: "AG", nameEn: "Antigua and Barbuda", nameFr: "Antigua-et-Barbuda", flag: "🇦🇬", phoneCode: "+1268", region: "Caribbean", timezone: "America/Antigua", utcOffset: "-04:00", priority: 3 },
  { code: "AR", nameEn: "Argentina", nameFr: "Argentine", flag: "🇦🇷", phoneCode: "+54", region: "South America", timezone: "America/Argentina/Buenos_Aires", utcOffset: "-03:00", priority: 3 },
  { code: "AM", nameEn: "Armenia", nameFr: "Arménie", flag: "🇦🇲", phoneCode: "+374", region: "Asia", timezone: "Asia/Yerevan", utcOffset: "+04:00", priority: 3 },
  { code: "AU", nameEn: "Australia", nameFr: "Australie", flag: "🇦🇺", phoneCode: "+61", region: "Oceania", timezone: "Australia/Sydney", utcOffset: "+10:00", priority: 2 },
  { code: "AT", nameEn: "Austria", nameFr: "Autriche", flag: "🇦🇹", phoneCode: "+43", region: "Europe", timezone: "Europe/Vienna", utcOffset: "+01:00", priority: 2 },
  { code: "AZ", nameEn: "Azerbaijan", nameFr: "Azerbaïdjan", flag: "🇦🇿", phoneCode: "+994", region: "Asia", timezone: "Asia/Baku", utcOffset: "+04:00", priority: 3 },
  { code: "BS", nameEn: "Bahamas", nameFr: "Bahamas", flag: "🇧🇸", phoneCode: "+1242", region: "Caribbean", timezone: "America/Nassau", utcOffset: "-05:00", priority: 3 },
  { code: "BH", nameEn: "Bahrain", nameFr: "Bahreïn", flag: "🇧🇭", phoneCode: "+973", region: "Middle East", timezone: "Asia/Bahrain", utcOffset: "+03:00", priority: 3 },
  { code: "BD", nameEn: "Bangladesh", nameFr: "Bangladesh", flag: "🇧🇩", phoneCode: "+880", region: "Asia", timezone: "Asia/Dhaka", utcOffset: "+06:00", priority: 3 },
  { code: "BB", nameEn: "Barbados", nameFr: "Barbade", flag: "🇧🇧", phoneCode: "+1246", region: "Caribbean", timezone: "America/Barbados", utcOffset: "-04:00", priority: 3 },
  { code: "BY", nameEn: "Belarus", nameFr: "Biélorussie", flag: "🇧🇾", phoneCode: "+375", region: "Europe", timezone: "Europe/Minsk", utcOffset: "+03:00", priority: 3 },
  { code: "BE", nameEn: "Belgium", nameFr: "Belgique", flag: "🇧🇪", phoneCode: "+32", region: "Europe", timezone: "Europe/Brussels", utcOffset: "+01:00", priority: 2 },
  { code: "BZ", nameEn: "Belize", nameFr: "Belize", flag: "🇧🇿", phoneCode: "+501", region: "Central America", timezone: "America/Belize", utcOffset: "-06:00", priority: 3 },
  { code: "BJ", nameEn: "Benin", nameFr: "Bénin", flag: "🇧🇯", phoneCode: "+229", region: "Africa", timezone: "Africa/Porto-Novo", utcOffset: "+01:00", priority: 3 },
  { code: "BT", nameEn: "Bhutan", nameFr: "Bhoutan", flag: "🇧🇹", phoneCode: "+975", region: "Asia", timezone: "Asia/Thimphu", utcOffset: "+06:00", priority: 3 },
  { code: "BO", nameEn: "Bolivia", nameFr: "Bolivie", flag: "🇧🇴", phoneCode: "+591", region: "South America", timezone: "America/La_Paz", utcOffset: "-04:00", priority: 3 },
  { code: "BA", nameEn: "Bosnia and Herzegovina", nameFr: "Bosnie-Herzégovine", flag: "🇧🇦", phoneCode: "+387", region: "Europe", timezone: "Europe/Sarajevo", utcOffset: "+01:00", priority: 3 },
  { code: "BW", nameEn: "Botswana", nameFr: "Botswana", flag: "🇧🇼", phoneCode: "+267", region: "Africa", timezone: "Africa/Gaborone", utcOffset: "+02:00", priority: 3 },
  { code: "BR", nameEn: "Brazil", nameFr: "Brésil", flag: "🇧🇷", phoneCode: "+55", region: "South America", timezone: "America/Sao_Paulo", utcOffset: "-03:00", priority: 2 },
  { code: "BN", nameEn: "Brunei", nameFr: "Brunei", flag: "🇧🇳", phoneCode: "+673", region: "Asia", timezone: "Asia/Brunei", utcOffset: "+08:00", priority: 3 },
  { code: "BG", nameEn: "Bulgaria", nameFr: "Bulgarie", flag: "🇧🇬", phoneCode: "+359", region: "Europe", timezone: "Europe/Sofia", utcOffset: "+02:00", priority: 3 },
  { code: "BF", nameEn: "Burkina Faso", nameFr: "Burkina Faso", flag: "🇧🇫", phoneCode: "+226", region: "Africa", timezone: "Africa/Ouagadougou", utcOffset: "+00:00", priority: 3 },
  { code: "BI", nameEn: "Burundi", nameFr: "Burundi", flag: "🇧🇮", phoneCode: "+257", region: "Africa", timezone: "Africa/Bujumbura", utcOffset: "+02:00", priority: 3 },
  { code: "CV", nameEn: "Cape Verde", nameFr: "Cap-Vert", flag: "🇨🇻", phoneCode: "+238", region: "Africa", timezone: "Atlantic/Cape_Verde", utcOffset: "-01:00", priority: 3 },
  { code: "KH", nameEn: "Cambodia", nameFr: "Cambodge", flag: "🇰🇭", phoneCode: "+855", region: "Asia", timezone: "Asia/Phnom_Penh", utcOffset: "+07:00", priority: 3 },
  { code: "CM", nameEn: "Cameroon", nameFr: "Cameroun", flag: "🇨🇲", phoneCode: "+237", region: "Africa", timezone: "Africa/Douala", utcOffset: "+01:00", priority: 3 },
  { code: "CA", nameEn: "Canada", nameFr: "Canada", flag: "🇨🇦", phoneCode: "+1", region: "North America", timezone: "America/Toronto", utcOffset: "-05:00", priority: 2 },
  { code: "CF", nameEn: "Central African Republic", nameFr: "République centrafricaine", flag: "🇨🇫", phoneCode: "+236", region: "Africa", timezone: "Africa/Bangui", utcOffset: "+01:00", priority: 3 },
  { code: "TD", nameEn: "Chad", nameFr: "Tchad", flag: "🇹🇩", phoneCode: "+235", region: "Africa", timezone: "Africa/Ndjamena", utcOffset: "+01:00", priority: 3 },
  { code: "CL", nameEn: "Chile", nameFr: "Chili", flag: "🇨🇱", phoneCode: "+56", region: "South America", timezone: "America/Santiago", utcOffset: "-04:00", priority: 3 },
  { code: "CO", nameEn: "Colombia", nameFr: "Colombie", flag: "🇨🇴", phoneCode: "+57", region: "South America", timezone: "America/Bogota", utcOffset: "-05:00", priority: 3 },
  { code: "KM", nameEn: "Comoros", nameFr: "Comores", flag: "🇰🇲", phoneCode: "+269", region: "Africa", timezone: "Indian/Comoro", utcOffset: "+03:00", priority: 3 },
  { code: "CG", nameEn: "Congo", nameFr: "Congo", flag: "🇨🇬", phoneCode: "+242", region: "Africa", timezone: "Africa/Brazzaville", utcOffset: "+01:00", priority: 3 },
  { code: "CD", nameEn: "DR Congo", nameFr: "RD Congo", flag: "🇨🇩", phoneCode: "+243", region: "Africa", timezone: "Africa/Kinshasa", utcOffset: "+01:00", priority: 3 },
  { code: "CR", nameEn: "Costa Rica", nameFr: "Costa Rica", flag: "🇨🇷", phoneCode: "+506", region: "Central America", timezone: "America/Costa_Rica", utcOffset: "-06:00", priority: 3 },
  { code: "CI", nameEn: "Côte d'Ivoire", nameFr: "Côte d'Ivoire", flag: "🇨🇮", phoneCode: "+225", region: "Africa", timezone: "Africa/Abidjan", utcOffset: "+00:00", priority: 3 },
  { code: "HR", nameEn: "Croatia", nameFr: "Croatie", flag: "🇭🇷", phoneCode: "+385", region: "Europe", timezone: "Europe/Zagreb", utcOffset: "+01:00", priority: 3 },
  { code: "CU", nameEn: "Cuba", nameFr: "Cuba", flag: "🇨🇺", phoneCode: "+53", region: "Caribbean", timezone: "America/Havana", utcOffset: "-05:00", priority: 3 },
  { code: "CY", nameEn: "Cyprus", nameFr: "Chypre", flag: "🇨🇾", phoneCode: "+357", region: "Europe", timezone: "Asia/Nicosia", utcOffset: "+02:00", priority: 3 },
  { code: "CZ", nameEn: "Czech Republic", nameFr: "République tchèque", flag: "🇨🇿", phoneCode: "+420", region: "Europe", timezone: "Europe/Prague", utcOffset: "+01:00", priority: 3 },
  { code: "DK", nameEn: "Denmark", nameFr: "Danemark", flag: "🇩🇰", phoneCode: "+45", region: "Europe", timezone: "Europe/Copenhagen", utcOffset: "+01:00", priority: 2 },
  { code: "DJ", nameEn: "Djibouti", nameFr: "Djibouti", flag: "🇩🇯", phoneCode: "+253", region: "Africa", timezone: "Africa/Djibouti", utcOffset: "+03:00", priority: 3 },
  { code: "DM", nameEn: "Dominica", nameFr: "Dominique", flag: "🇩🇲", phoneCode: "+1767", region: "Caribbean", timezone: "America/Dominica", utcOffset: "-04:00", priority: 3 },
  { code: "DO", nameEn: "Dominican Republic", nameFr: "République dominicaine", flag: "🇩🇴", phoneCode: "+1809", region: "Caribbean", timezone: "America/Santo_Domingo", utcOffset: "-04:00", priority: 3 },
  { code: "EC", nameEn: "Ecuador", nameFr: "Équateur", flag: "🇪🇨", phoneCode: "+593", region: "South America", timezone: "America/Guayaquil", utcOffset: "-05:00", priority: 3 },
  { code: "EG", nameEn: "Egypt", nameFr: "Égypte", flag: "🇪🇬", phoneCode: "+20", region: "Africa", timezone: "Africa/Cairo", utcOffset: "+02:00", priority: 3 },
  { code: "SV", nameEn: "El Salvador", nameFr: "Salvador", flag: "🇸🇻", phoneCode: "+503", region: "Central America", timezone: "America/El_Salvador", utcOffset: "-06:00", priority: 3 },
  { code: "GQ", nameEn: "Equatorial Guinea", nameFr: "Guinée équatoriale", flag: "🇬🇶", phoneCode: "+240", region: "Africa", timezone: "Africa/Malabo", utcOffset: "+01:00", priority: 3 },
  { code: "ER", nameEn: "Eritrea", nameFr: "Érythrée", flag: "🇪🇷", phoneCode: "+291", region: "Africa", timezone: "Africa/Asmara", utcOffset: "+03:00", priority: 3 },
  { code: "EE", nameEn: "Estonia", nameFr: "Estonie", flag: "🇪🇪", phoneCode: "+372", region: "Europe", timezone: "Europe/Tallinn", utcOffset: "+02:00", priority: 3 },
  { code: "SZ", nameEn: "Eswatini", nameFr: "Eswatini", flag: "🇸🇿", phoneCode: "+268", region: "Africa", timezone: "Africa/Mbabane", utcOffset: "+02:00", priority: 3 },
  { code: "ET", nameEn: "Ethiopia", nameFr: "Éthiopie", flag: "🇪🇹", phoneCode: "+251", region: "Africa", timezone: "Africa/Addis_Ababa", utcOffset: "+03:00", priority: 3 },
  { code: "FJ", nameEn: "Fiji", nameFr: "Fidji", flag: "🇫🇯", phoneCode: "+679", region: "Oceania", timezone: "Pacific/Fiji", utcOffset: "+12:00", priority: 3 },
  { code: "FI", nameEn: "Finland", nameFr: "Finlande", flag: "🇫🇮", phoneCode: "+358", region: "Europe", timezone: "Europe/Helsinki", utcOffset: "+02:00", priority: 2 },
  { code: "GA", nameEn: "Gabon", nameFr: "Gabon", flag: "🇬🇦", phoneCode: "+241", region: "Africa", timezone: "Africa/Libreville", utcOffset: "+01:00", priority: 3 },
  { code: "GM", nameEn: "Gambia", nameFr: "Gambie", flag: "🇬🇲", phoneCode: "+220", region: "Africa", timezone: "Africa/Banjul", utcOffset: "+00:00", priority: 3 },
  { code: "GE", nameEn: "Georgia", nameFr: "Géorgie", flag: "🇬🇪", phoneCode: "+995", region: "Asia", timezone: "Asia/Tbilisi", utcOffset: "+04:00", priority: 3 },
  { code: "GH", nameEn: "Ghana", nameFr: "Ghana", flag: "🇬🇭", phoneCode: "+233", region: "Africa", timezone: "Africa/Accra", utcOffset: "+00:00", priority: 3 },
  { code: "GR", nameEn: "Greece", nameFr: "Grèce", flag: "🇬🇷", phoneCode: "+30", region: "Europe", timezone: "Europe/Athens", utcOffset: "+02:00", priority: 2 },
  { code: "GD", nameEn: "Grenada", nameFr: "Grenade", flag: "🇬🇩", phoneCode: "+1473", region: "Caribbean", timezone: "America/Grenada", utcOffset: "-04:00", priority: 3 },
  { code: "GT", nameEn: "Guatemala", nameFr: "Guatemala", flag: "🇬🇹", phoneCode: "+502", region: "Central America", timezone: "America/Guatemala", utcOffset: "-06:00", priority: 3 },
  { code: "GN", nameEn: "Guinea", nameFr: "Guinée", flag: "🇬🇳", phoneCode: "+224", region: "Africa", timezone: "Africa/Conakry", utcOffset: "+00:00", priority: 3 },
  { code: "GW", nameEn: "Guinea-Bissau", nameFr: "Guinée-Bissau", flag: "🇬🇼", phoneCode: "+245", region: "Africa", timezone: "Africa/Bissau", utcOffset: "+00:00", priority: 3 },
  { code: "GY", nameEn: "Guyana", nameFr: "Guyana", flag: "🇬🇾", phoneCode: "+592", region: "South America", timezone: "America/Guyana", utcOffset: "-04:00", priority: 3 },
  { code: "HT", nameEn: "Haiti", nameFr: "Haïti", flag: "🇭🇹", phoneCode: "+509", region: "Caribbean", timezone: "America/Port-au-Prince", utcOffset: "-05:00", priority: 3 },
  { code: "HN", nameEn: "Honduras", nameFr: "Honduras", flag: "🇭🇳", phoneCode: "+504", region: "Central America", timezone: "America/Tegucigalpa", utcOffset: "-06:00", priority: 3 },
  { code: "HU", nameEn: "Hungary", nameFr: "Hongrie", flag: "🇭🇺", phoneCode: "+36", region: "Europe", timezone: "Europe/Budapest", utcOffset: "+01:00", priority: 2 },
  { code: "IS", nameEn: "Iceland", nameFr: "Islande", flag: "🇮🇸", phoneCode: "+354", region: "Europe", timezone: "Atlantic/Reykjavik", utcOffset: "+00:00", priority: 3 },
  { code: "IN", nameEn: "India", nameFr: "Inde", flag: "🇮🇳", phoneCode: "+91", region: "Asia", timezone: "Asia/Kolkata", utcOffset: "+05:30", priority: 2 },
  { code: "ID", nameEn: "Indonesia", nameFr: "Indonésie", flag: "🇮🇩", phoneCode: "+62", region: "Asia", timezone: "Asia/Jakarta", utcOffset: "+07:00", priority: 2 },
  { code: "IR", nameEn: "Iran", nameFr: "Iran", flag: "🇮🇷", phoneCode: "+98", region: "Middle East", timezone: "Asia/Tehran", utcOffset: "+03:30", priority: 3 },
  { code: "IQ", nameEn: "Iraq", nameFr: "Irak", flag: "🇮🇶", phoneCode: "+964", region: "Middle East", timezone: "Asia/Baghdad", utcOffset: "+03:00", priority: 3 },
  { code: "IE", nameEn: "Ireland", nameFr: "Irlande", flag: "🇮🇪", phoneCode: "+353", region: "Europe", timezone: "Europe/Dublin", utcOffset: "+00:00", priority: 2 },
  { code: "IL", nameEn: "Israel", nameFr: "Israël", flag: "🇮🇱", phoneCode: "+972", region: "Middle East", timezone: "Asia/Jerusalem", utcOffset: "+02:00", priority: 2 },
  { code: "IT", nameEn: "Italy", nameFr: "Italie", flag: "🇮🇹", phoneCode: "+39", region: "Europe", timezone: "Europe/Rome", utcOffset: "+01:00", priority: 2 },
  { code: "JM", nameEn: "Jamaica", nameFr: "Jamaïque", flag: "🇯🇲", phoneCode: "+1876", region: "Caribbean", timezone: "America/Jamaica", utcOffset: "-05:00", priority: 3 },
  { code: "JP", nameEn: "Japan", nameFr: "Japon", flag: "🇯🇵", phoneCode: "+81", region: "Asia", timezone: "Asia/Tokyo", utcOffset: "+09:00", priority: 2 },
  { code: "JO", nameEn: "Jordan", nameFr: "Jordanie", flag: "🇯🇴", phoneCode: "+962", region: "Middle East", timezone: "Asia/Amman", utcOffset: "+02:00", priority: 3 },
  { code: "KZ", nameEn: "Kazakhstan", nameFr: "Kazakhstan", flag: "🇰🇿", phoneCode: "+7", region: "Asia", timezone: "Asia/Almaty", utcOffset: "+06:00", priority: 3 },
  { code: "KE", nameEn: "Kenya", nameFr: "Kenya", flag: "🇰🇪", phoneCode: "+254", region: "Africa", timezone: "Africa/Nairobi", utcOffset: "+03:00", priority: 3 },
  { code: "KI", nameEn: "Kiribati", nameFr: "Kiribati", flag: "🇰🇮", phoneCode: "+686", region: "Oceania", timezone: "Pacific/Tarawa", utcOffset: "+12:00", priority: 3 },
  { code: "KP", nameEn: "North Korea", nameFr: "Corée du Nord", flag: "🇰🇵", phoneCode: "+850", region: "Asia", timezone: "Asia/Pyongyang", utcOffset: "+09:00", priority: 3 },
  { code: "KR", nameEn: "South Korea", nameFr: "Corée du Sud", flag: "🇰🇷", phoneCode: "+82", region: "Asia", timezone: "Asia/Seoul", utcOffset: "+09:00", priority: 2 },
  { code: "KW", nameEn: "Kuwait", nameFr: "Koweït", flag: "🇰🇼", phoneCode: "+965", region: "Middle East", timezone: "Asia/Kuwait", utcOffset: "+03:00", priority: 3 },
  { code: "KG", nameEn: "Kyrgyzstan", nameFr: "Kirghizistan", flag: "🇰🇬", phoneCode: "+996", region: "Asia", timezone: "Asia/Bishkek", utcOffset: "+06:00", priority: 3 },
  { code: "LA", nameEn: "Laos", nameFr: "Laos", flag: "🇱🇦", phoneCode: "+856", region: "Asia", timezone: "Asia/Vientiane", utcOffset: "+07:00", priority: 3 },
  { code: "LV", nameEn: "Latvia", nameFr: "Lettonie", flag: "🇱🇻", phoneCode: "+371", region: "Europe", timezone: "Europe/Riga", utcOffset: "+02:00", priority: 3 },
  { code: "LB", nameEn: "Lebanon", nameFr: "Liban", flag: "🇱🇧", phoneCode: "+961", region: "Middle East", timezone: "Asia/Beirut", utcOffset: "+02:00", priority: 3 },
  { code: "LS", nameEn: "Lesotho", nameFr: "Lesotho", flag: "🇱🇸", phoneCode: "+266", region: "Africa", timezone: "Africa/Maseru", utcOffset: "+02:00", priority: 3 },
  { code: "LR", nameEn: "Liberia", nameFr: "Liberia", flag: "🇱🇷", phoneCode: "+231", region: "Africa", timezone: "Africa/Monrovia", utcOffset: "+00:00", priority: 3 },
  { code: "LY", nameEn: "Libya", nameFr: "Libye", flag: "🇱🇾", phoneCode: "+218", region: "Africa", timezone: "Africa/Tripoli", utcOffset: "+02:00", priority: 3 },
  { code: "LI", nameEn: "Liechtenstein", nameFr: "Liechtenstein", flag: "🇱🇮", phoneCode: "+423", region: "Europe", timezone: "Europe/Vaduz", utcOffset: "+01:00", priority: 3 },
  { code: "LT", nameEn: "Lithuania", nameFr: "Lituanie", flag: "🇱🇹", phoneCode: "+370", region: "Europe", timezone: "Europe/Vilnius", utcOffset: "+02:00", priority: 3 },
  { code: "LU", nameEn: "Luxembourg", nameFr: "Luxembourg", flag: "🇱🇺", phoneCode: "+352", region: "Europe", timezone: "Europe/Luxembourg", utcOffset: "+01:00", priority: 2 },
  { code: "MG", nameEn: "Madagascar", nameFr: "Madagascar", flag: "🇲🇬", phoneCode: "+261", region: "Africa", timezone: "Indian/Antananarivo", utcOffset: "+03:00", priority: 3 },
  { code: "MW", nameEn: "Malawi", nameFr: "Malawi", flag: "🇲🇼", phoneCode: "+265", region: "Africa", timezone: "Africa/Blantyre", utcOffset: "+02:00", priority: 3 },
  { code: "MY", nameEn: "Malaysia", nameFr: "Malaisie", flag: "🇲🇾", phoneCode: "+60", region: "Asia", timezone: "Asia/Kuala_Lumpur", utcOffset: "+08:00", priority: 2 },
  { code: "MV", nameEn: "Maldives", nameFr: "Maldives", flag: "🇲🇻", phoneCode: "+960", region: "Asia", timezone: "Indian/Maldives", utcOffset: "+05:00", priority: 3 },
  { code: "ML", nameEn: "Mali", nameFr: "Mali", flag: "🇲🇱", phoneCode: "+223", region: "Africa", timezone: "Africa/Bamako", utcOffset: "+00:00", priority: 3 },
  { code: "MT", nameEn: "Malta", nameFr: "Malte", flag: "🇲🇹", phoneCode: "+356", region: "Europe", timezone: "Europe/Malta", utcOffset: "+01:00", priority: 3 },
  { code: "MH", nameEn: "Marshall Islands", nameFr: "Îles Marshall", flag: "🇲🇭", phoneCode: "+692", region: "Oceania", timezone: "Pacific/Majuro", utcOffset: "+12:00", priority: 3 },
  { code: "MR", nameEn: "Mauritania", nameFr: "Mauritanie", flag: "🇲🇷", phoneCode: "+222", region: "Africa", timezone: "Africa/Nouakchott", utcOffset: "+00:00", priority: 3 },
  { code: "MU", nameEn: "Mauritius", nameFr: "Maurice", flag: "🇲🇺", phoneCode: "+230", region: "Africa", timezone: "Indian/Mauritius", utcOffset: "+04:00", priority: 3 },
  { code: "MX", nameEn: "Mexico", nameFr: "Mexique", flag: "🇲🇽", phoneCode: "+52", region: "North America", timezone: "America/Mexico_City", utcOffset: "-06:00", priority: 2 },
  { code: "FM", nameEn: "Micronesia", nameFr: "Micronésie", flag: "🇫🇲", phoneCode: "+691", region: "Oceania", timezone: "Pacific/Pohnpei", utcOffset: "+11:00", priority: 3 },
  { code: "MD", nameEn: "Moldova", nameFr: "Moldavie", flag: "🇲🇩", phoneCode: "+373", region: "Europe", timezone: "Europe/Chisinau", utcOffset: "+02:00", priority: 3 },
  { code: "MC", nameEn: "Monaco", nameFr: "Monaco", flag: "🇲🇨", phoneCode: "+377", region: "Europe", timezone: "Europe/Monaco", utcOffset: "+01:00", priority: 3 },
  { code: "MN", nameEn: "Mongolia", nameFr: "Mongolie", flag: "🇲🇳", phoneCode: "+976", region: "Asia", timezone: "Asia/Ulaanbaatar", utcOffset: "+08:00", priority: 3 },
  { code: "ME", nameEn: "Montenegro", nameFr: "Monténégro", flag: "🇲🇪", phoneCode: "+382", region: "Europe", timezone: "Europe/Podgorica", utcOffset: "+01:00", priority: 3 },
  { code: "MA", nameEn: "Morocco", nameFr: "Maroc", flag: "🇲🇦", phoneCode: "+212", region: "Africa", timezone: "Africa/Casablanca", utcOffset: "+01:00", priority: 2 },
  { code: "MZ", nameEn: "Mozambique", nameFr: "Mozambique", flag: "🇲🇿", phoneCode: "+258", region: "Africa", timezone: "Africa/Maputo", utcOffset: "+02:00", priority: 3 },
  { code: "MM", nameEn: "Myanmar", nameFr: "Myanmar", flag: "🇲🇲", phoneCode: "+95", region: "Asia", timezone: "Asia/Yangon", utcOffset: "+06:30", priority: 3 },
  { code: "NA", nameEn: "Namibia", nameFr: "Namibie", flag: "🇳🇦", phoneCode: "+264", region: "Africa", timezone: "Africa/Windhoek", utcOffset: "+02:00", priority: 3 },
  { code: "NR", nameEn: "Nauru", nameFr: "Nauru", flag: "🇳🇷", phoneCode: "+674", region: "Oceania", timezone: "Pacific/Nauru", utcOffset: "+12:00", priority: 3 },
  { code: "NP", nameEn: "Nepal", nameFr: "Népal", flag: "🇳🇵", phoneCode: "+977", region: "Asia", timezone: "Asia/Kathmandu", utcOffset: "+05:45", priority: 3 },
  { code: "NL", nameEn: "Netherlands", nameFr: "Pays-Bas", flag: "🇳🇱", phoneCode: "+31", region: "Europe", timezone: "Europe/Amsterdam", utcOffset: "+01:00", priority: 2 },
  { code: "NZ", nameEn: "New Zealand", nameFr: "Nouvelle-Zélande", flag: "🇳🇿", phoneCode: "+64", region: "Oceania", timezone: "Pacific/Auckland", utcOffset: "+12:00", priority: 2 },
  { code: "NI", nameEn: "Nicaragua", nameFr: "Nicaragua", flag: "🇳🇮", phoneCode: "+505", region: "Central America", timezone: "America/Managua", utcOffset: "-06:00", priority: 3 },
  { code: "NE", nameEn: "Niger", nameFr: "Niger", flag: "🇳🇪", phoneCode: "+227", region: "Africa", timezone: "Africa/Niamey", utcOffset: "+01:00", priority: 3 },
  { code: "NG", nameEn: "Nigeria", nameFr: "Nigeria", flag: "🇳🇬", phoneCode: "+234", region: "Africa", timezone: "Africa/Lagos", utcOffset: "+01:00", priority: 2 },
  { code: "MK", nameEn: "North Macedonia", nameFr: "Macédoine du Nord", flag: "🇲🇰", phoneCode: "+389", region: "Europe", timezone: "Europe/Skopje", utcOffset: "+01:00", priority: 3 },
  { code: "NO", nameEn: "Norway", nameFr: "Norvège", flag: "🇳🇴", phoneCode: "+47", region: "Europe", timezone: "Europe/Oslo", utcOffset: "+01:00", priority: 2 },
  { code: "OM", nameEn: "Oman", nameFr: "Oman", flag: "🇴🇲", phoneCode: "+968", region: "Middle East", timezone: "Asia/Muscat", utcOffset: "+04:00", priority: 3 },
  { code: "PK", nameEn: "Pakistan", nameFr: "Pakistan", flag: "🇵🇰", phoneCode: "+92", region: "Asia", timezone: "Asia/Karachi", utcOffset: "+05:00", priority: 2 },
  { code: "PW", nameEn: "Palau", nameFr: "Palaos", flag: "🇵🇼", phoneCode: "+680", region: "Oceania", timezone: "Pacific/Palau", utcOffset: "+09:00", priority: 3 },
  { code: "PS", nameEn: "Palestine", nameFr: "Palestine", flag: "🇵🇸", phoneCode: "+970", region: "Middle East", timezone: "Asia/Gaza", utcOffset: "+02:00", priority: 3 },
  { code: "PA", nameEn: "Panama", nameFr: "Panama", flag: "🇵🇦", phoneCode: "+507", region: "Central America", timezone: "America/Panama", utcOffset: "-05:00", priority: 3 },
  { code: "PG", nameEn: "Papua New Guinea", nameFr: "Papouasie-Nouvelle-Guinée", flag: "🇵🇬", phoneCode: "+675", region: "Oceania", timezone: "Pacific/Port_Moresby", utcOffset: "+10:00", priority: 3 },
  { code: "PY", nameEn: "Paraguay", nameFr: "Paraguay", flag: "🇵🇾", phoneCode: "+595", region: "South America", timezone: "America/Asuncion", utcOffset: "-04:00", priority: 3 },
  { code: "PE", nameEn: "Peru", nameFr: "Pérou", flag: "🇵🇪", phoneCode: "+51", region: "South America", timezone: "America/Lima", utcOffset: "-05:00", priority: 3 },
  { code: "PH", nameEn: "Philippines", nameFr: "Philippines", flag: "🇵🇭", phoneCode: "+63", region: "Asia", timezone: "Asia/Manila", utcOffset: "+08:00", priority: 2 },
  { code: "PL", nameEn: "Poland", nameFr: "Pologne", flag: "🇵🇱", phoneCode: "+48", region: "Europe", timezone: "Europe/Warsaw", utcOffset: "+01:00", priority: 2 },
  { code: "PT", nameEn: "Portugal", nameFr: "Portugal", flag: "🇵🇹", phoneCode: "+351", region: "Europe", timezone: "Europe/Lisbon", utcOffset: "+00:00", priority: 2 },
  { code: "QA", nameEn: "Qatar", nameFr: "Qatar", flag: "🇶🇦", phoneCode: "+974", region: "Middle East", timezone: "Asia/Qatar", utcOffset: "+03:00", priority: 2 },
  { code: "RO", nameEn: "Romania", nameFr: "Roumanie", flag: "🇷🇴", phoneCode: "+40", region: "Europe", timezone: "Europe/Bucharest", utcOffset: "+02:00", priority: 2 },
  { code: "RW", nameEn: "Rwanda", nameFr: "Rwanda", flag: "🇷🇼", phoneCode: "+250", region: "Africa", timezone: "Africa/Kigali", utcOffset: "+02:00", priority: 3 },
  { code: "KN", nameEn: "Saint Kitts and Nevis", nameFr: "Saint-Kitts-et-Nevis", flag: "🇰🇳", phoneCode: "+1869", region: "Caribbean", timezone: "America/St_Kitts", utcOffset: "-04:00", priority: 3 },
  { code: "LC", nameEn: "Saint Lucia", nameFr: "Sainte-Lucie", flag: "🇱🇨", phoneCode: "+1758", region: "Caribbean", timezone: "America/St_Lucia", utcOffset: "-04:00", priority: 3 },
  { code: "VC", nameEn: "Saint Vincent and the Grenadines", nameFr: "Saint-Vincent-et-les-Grenadines", flag: "🇻🇨", phoneCode: "+1784", region: "Caribbean", timezone: "America/St_Vincent", utcOffset: "-04:00", priority: 3 },
  { code: "WS", nameEn: "Samoa", nameFr: "Samoa", flag: "🇼🇸", phoneCode: "+685", region: "Oceania", timezone: "Pacific/Apia", utcOffset: "+13:00", priority: 3 },
  { code: "SM", nameEn: "San Marino", nameFr: "Saint-Marin", flag: "🇸🇲", phoneCode: "+378", region: "Europe", timezone: "Europe/San_Marino", utcOffset: "+01:00", priority: 3 },
  { code: "ST", nameEn: "São Tomé and Príncipe", nameFr: "São Tomé-et-Principe", flag: "🇸🇹", phoneCode: "+239", region: "Africa", timezone: "Africa/Sao_Tome", utcOffset: "+00:00", priority: 3 },
  { code: "SA", nameEn: "Saudi Arabia", nameFr: "Arabie saoudite", flag: "🇸🇦", phoneCode: "+966", region: "Middle East", timezone: "Asia/Riyadh", utcOffset: "+03:00", priority: 2 },
  { code: "SN", nameEn: "Senegal", nameFr: "Sénégal", flag: "🇸🇳", phoneCode: "+221", region: "Africa", timezone: "Africa/Dakar", utcOffset: "+00:00", priority: 3 },
  { code: "RS", nameEn: "Serbia", nameFr: "Serbie", flag: "🇷🇸", phoneCode: "+381", region: "Europe", timezone: "Europe/Belgrade", utcOffset: "+01:00", priority: 3 },
  { code: "SC", nameEn: "Seychelles", nameFr: "Seychelles", flag: "🇸🇨", phoneCode: "+248", region: "Africa", timezone: "Indian/Mahe", utcOffset: "+04:00", priority: 3 },
  { code: "SL", nameEn: "Sierra Leone", nameFr: "Sierra Leone", flag: "🇸🇱", phoneCode: "+232", region: "Africa", timezone: "Africa/Freetown", utcOffset: "+00:00", priority: 3 },
  { code: "SG", nameEn: "Singapore", nameFr: "Singapour", flag: "🇸🇬", phoneCode: "+65", region: "Asia", timezone: "Asia/Singapore", utcOffset: "+08:00", priority: 2 },
  { code: "SK", nameEn: "Slovakia", nameFr: "Slovaquie", flag: "🇸🇰", phoneCode: "+421", region: "Europe", timezone: "Europe/Bratislava", utcOffset: "+01:00", priority: 3 },
  { code: "SI", nameEn: "Slovenia", nameFr: "Slovénie", flag: "🇸🇮", phoneCode: "+386", region: "Europe", timezone: "Europe/Ljubljana", utcOffset: "+01:00", priority: 3 },
  { code: "SB", nameEn: "Solomon Islands", nameFr: "Îles Salomon", flag: "🇸🇧", phoneCode: "+677", region: "Oceania", timezone: "Pacific/Guadalcanal", utcOffset: "+11:00", priority: 3 },
  { code: "SO", nameEn: "Somalia", nameFr: "Somalie", flag: "🇸🇴", phoneCode: "+252", region: "Africa", timezone: "Africa/Mogadishu", utcOffset: "+03:00", priority: 3 },
  { code: "ZA", nameEn: "South Africa", nameFr: "Afrique du Sud", flag: "🇿🇦", phoneCode: "+27", region: "Africa", timezone: "Africa/Johannesburg", utcOffset: "+02:00", priority: 2 },
  { code: "SS", nameEn: "South Sudan", nameFr: "Soudan du Sud", flag: "🇸🇸", phoneCode: "+211", region: "Africa", timezone: "Africa/Juba", utcOffset: "+02:00", priority: 3 },
  { code: "LK", nameEn: "Sri Lanka", nameFr: "Sri Lanka", flag: "🇱🇰", phoneCode: "+94", region: "Asia", timezone: "Asia/Colombo", utcOffset: "+05:30", priority: 3 },
  { code: "SD", nameEn: "Sudan", nameFr: "Soudan", flag: "🇸🇩", phoneCode: "+249", region: "Africa", timezone: "Africa/Khartoum", utcOffset: "+02:00", priority: 3 },
  { code: "SR", nameEn: "Suriname", nameFr: "Suriname", flag: "🇸🇷", phoneCode: "+597", region: "South America", timezone: "America/Paramaribo", utcOffset: "-03:00", priority: 3 },
  { code: "SE", nameEn: "Sweden", nameFr: "Suède", flag: "🇸🇪", phoneCode: "+46", region: "Europe", timezone: "Europe/Stockholm", utcOffset: "+01:00", priority: 2 },
  { code: "CH", nameEn: "Switzerland", nameFr: "Suisse", flag: "🇨🇭", phoneCode: "+41", region: "Europe", timezone: "Europe/Zurich", utcOffset: "+01:00", priority: 2 },
  { code: "SY", nameEn: "Syria", nameFr: "Syrie", flag: "🇸🇾", phoneCode: "+963", region: "Middle East", timezone: "Asia/Damascus", utcOffset: "+02:00", priority: 3 },
  { code: "TW", nameEn: "Taiwan", nameFr: "Taïwan", flag: "🇹🇼", phoneCode: "+886", region: "Asia", timezone: "Asia/Taipei", utcOffset: "+08:00", priority: 2 },
  { code: "TJ", nameEn: "Tajikistan", nameFr: "Tadjikistan", flag: "🇹🇯", phoneCode: "+992", region: "Asia", timezone: "Asia/Dushanbe", utcOffset: "+05:00", priority: 3 },
  { code: "TZ", nameEn: "Tanzania", nameFr: "Tanzanie", flag: "🇹🇿", phoneCode: "+255", region: "Africa", timezone: "Africa/Dar_es_Salaam", utcOffset: "+03:00", priority: 3 },
  { code: "TH", nameEn: "Thailand", nameFr: "Thaïlande", flag: "🇹🇭", phoneCode: "+66", region: "Asia", timezone: "Asia/Bangkok", utcOffset: "+07:00", priority: 2 },
  { code: "TL", nameEn: "Timor-Leste", nameFr: "Timor-Leste", flag: "🇹🇱", phoneCode: "+670", region: "Asia", timezone: "Asia/Dili", utcOffset: "+09:00", priority: 3 },
  { code: "TG", nameEn: "Togo", nameFr: "Togo", flag: "🇹🇬", phoneCode: "+228", region: "Africa", timezone: "Africa/Lome", utcOffset: "+00:00", priority: 3 },
  { code: "TO", nameEn: "Tonga", nameFr: "Tonga", flag: "🇹🇴", phoneCode: "+676", region: "Oceania", timezone: "Pacific/Tongatapu", utcOffset: "+13:00", priority: 3 },
  { code: "TT", nameEn: "Trinidad and Tobago", nameFr: "Trinité-et-Tobago", flag: "🇹🇹", phoneCode: "+1868", region: "Caribbean", timezone: "America/Port_of_Spain", utcOffset: "-04:00", priority: 3 },
  { code: "TN", nameEn: "Tunisia", nameFr: "Tunisie", flag: "🇹🇳", phoneCode: "+216", region: "Africa", timezone: "Africa/Tunis", utcOffset: "+01:00", priority: 2 },
  { code: "TR", nameEn: "Turkey", nameFr: "Turquie", flag: "🇹🇷", phoneCode: "+90", region: "Middle East", timezone: "Europe/Istanbul", utcOffset: "+03:00", priority: 2 },
  { code: "TM", nameEn: "Turkmenistan", nameFr: "Turkménistan", flag: "🇹🇲", phoneCode: "+993", region: "Asia", timezone: "Asia/Ashgabat", utcOffset: "+05:00", priority: 3 },
  { code: "TV", nameEn: "Tuvalu", nameFr: "Tuvalu", flag: "🇹🇻", phoneCode: "+688", region: "Oceania", timezone: "Pacific/Funafuti", utcOffset: "+12:00", priority: 3 },
  { code: "UG", nameEn: "Uganda", nameFr: "Ouganda", flag: "🇺🇬", phoneCode: "+256", region: "Africa", timezone: "Africa/Kampala", utcOffset: "+03:00", priority: 3 },
  { code: "UA", nameEn: "Ukraine", nameFr: "Ukraine", flag: "🇺🇦", phoneCode: "+380", region: "Europe", timezone: "Europe/Kiev", utcOffset: "+02:00", priority: 2 },
  { code: "AE", nameEn: "United Arab Emirates", nameFr: "Émirats arabes unis", flag: "🇦🇪", phoneCode: "+971", region: "Middle East", timezone: "Asia/Dubai", utcOffset: "+04:00", priority: 2 },
  { code: "US", nameEn: "United States", nameFr: "États-Unis", flag: "🇺🇸", phoneCode: "+1", region: "North America", timezone: "America/New_York", utcOffset: "-05:00", priority: 1 },
  { code: "UY", nameEn: "Uruguay", nameFr: "Uruguay", flag: "🇺🇾", phoneCode: "+598", region: "South America", timezone: "America/Montevideo", utcOffset: "-03:00", priority: 3 },
  { code: "UZ", nameEn: "Uzbekistan", nameFr: "Ouzbékistan", flag: "🇺🇿", phoneCode: "+998", region: "Asia", timezone: "Asia/Tashkent", utcOffset: "+05:00", priority: 3 },
  { code: "VU", nameEn: "Vanuatu", nameFr: "Vanuatu", flag: "🇻🇺", phoneCode: "+678", region: "Oceania", timezone: "Pacific/Efate", utcOffset: "+11:00", priority: 3 },
  { code: "VA", nameEn: "Vatican City", nameFr: "Vatican", flag: "🇻🇦", phoneCode: "+379", region: "Europe", timezone: "Europe/Vatican", utcOffset: "+01:00", priority: 3 },
  { code: "VE", nameEn: "Venezuela", nameFr: "Venezuela", flag: "🇻🇪", phoneCode: "+58", region: "South America", timezone: "America/Caracas", utcOffset: "-04:00", priority: 3 },
  { code: "VN", nameEn: "Vietnam", nameFr: "Vietnam", flag: "🇻🇳", phoneCode: "+84", region: "Asia", timezone: "Asia/Ho_Chi_Minh", utcOffset: "+07:00", priority: 2 },
  { code: "YE", nameEn: "Yemen", nameFr: "Yémen", flag: "🇾🇪", phoneCode: "+967", region: "Middle East", timezone: "Asia/Aden", utcOffset: "+03:00", priority: 3 },
  { code: "ZM", nameEn: "Zambia", nameFr: "Zambie", flag: "🇿🇲", phoneCode: "+260", region: "Africa", timezone: "Africa/Lusaka", utcOffset: "+02:00", priority: 3 },
  { code: "ZW", nameEn: "Zimbabwe", nameFr: "Zimbabwe", flag: "🇿🇼", phoneCode: "+263", region: "Africa", timezone: "Africa/Harare", utcOffset: "+02:00", priority: 3 },
];

/**
 * Helper: Get country by ISO code
 */
export function getCountryByCode(code: string): CountryData | undefined {
  return countries.find((c) => c.code === code.toUpperCase());
}

/**
 * Helper: Get timezone for a country code
 */
export function getTimezoneForCountry(countryCode: string): string {
  const country = getCountryByCode(countryCode);
  return country?.timezone ?? "UTC";
}

/**
 * Helper: Get UTC offset for a country code
 */
export function getUtcOffsetForCountry(countryCode: string): string {
  const country = getCountryByCode(countryCode);
  return country?.utcOffset ?? "+00:00";
}

/**
 * Helper: Get all countries sorted by priority
 */
export function getCountriesByPriority(): CountryData[] {
  return [...countries].sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999));
}
