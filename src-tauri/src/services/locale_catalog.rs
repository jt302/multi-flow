/// 国家码 → 语言 / 时区映射目录
///
/// 未知国家返回 None，由调用方决定降级策略（不强制 en-US）。
pub fn default_language_for_country(country: &str) -> Option<String> {
    let value = match country.trim().to_uppercase().as_str() {
        "CN" => "zh-CN",
        "TW" => "zh-TW",
        "HK" => "zh-HK",
        "JP" => "ja-JP",
        "KR" => "ko-KR",
        "DE" => "de-DE",
        "FR" => "fr-FR",
        "GB" => "en-GB",
        "US" => "en-US",
        "CA" => "en-CA",
        "AU" => "en-AU",
        "SG" => "en-SG",
        "IN" => "en-IN",
        "BR" => "pt-BR",
        "IT" => "it-IT",
        "NL" => "nl-NL",
        "RU" => "ru-RU",
        "SE" => "sv-SE",
        "VN" => "vi-VN",
        "TH" => "th-TH",
        "ID" => "id-ID",
        "MX" => "es-MX",
        "TR" => "tr-TR",
        "PL" => "pl-PL",
        "ES" => "es-ES",
        "PT" => "pt-PT",
        "AR" => "es-AR",
        "SA" => "ar-SA",
        "AE" => "ar-AE",
        "MY" => "ms-MY",
        "PH" => "fil-PH",
        "UA" => "uk-UA",
        "CZ" => "cs-CZ",
        "HU" => "hu-HU",
        "RO" => "ro-RO",
        "BG" => "bg-BG",
        "HR" => "hr-HR",
        "SK" => "sk-SK",
        "NO" => "nb-NO",
        "FI" => "fi-FI",
        "DK" => "da-DK",
        "CH" => "de-CH",
        "AT" => "de-AT",
        "BE" => "nl-BE",
        "GR" => "el-GR",
        "IL" => "he-IL",
        "EG" => "ar-EG",
        "ZA" => "en-ZA",
        "NG" => "en-NG",
        "NZ" => "en-NZ",
        _ => return None,
    };
    Some(value.to_string())
}

pub fn default_timezone_for_country(country: &str) -> Option<String> {
    let value = match country.trim().to_uppercase().as_str() {
        "CN" => "Asia/Shanghai",
        "TW" => "Asia/Taipei",
        "HK" => "Asia/Hong_Kong",
        "JP" => "Asia/Tokyo",
        "KR" => "Asia/Seoul",
        "DE" => "Europe/Berlin",
        "FR" => "Europe/Paris",
        "GB" => "Europe/London",
        "US" => "America/New_York",
        "CA" => "America/Toronto",
        "AU" => "Australia/Sydney",
        "SG" => "Asia/Singapore",
        "IN" => "Asia/Kolkata",
        "BR" => "America/Sao_Paulo",
        "IT" => "Europe/Rome",
        "NL" => "Europe/Amsterdam",
        "RU" => "Europe/Moscow",
        "SE" => "Europe/Stockholm",
        "VN" => "Asia/Ho_Chi_Minh",
        "TH" => "Asia/Bangkok",
        "ID" => "Asia/Jakarta",
        "MX" => "America/Mexico_City",
        "TR" => "Europe/Istanbul",
        "PL" => "Europe/Warsaw",
        "ES" => "Europe/Madrid",
        "PT" => "Europe/Lisbon",
        "AR" => "America/Argentina/Buenos_Aires",
        "SA" => "Asia/Riyadh",
        "AE" => "Asia/Dubai",
        "MY" => "Asia/Kuala_Lumpur",
        "PH" => "Asia/Manila",
        "UA" => "Europe/Kiev",
        "CZ" => "Europe/Prague",
        "HU" => "Europe/Budapest",
        "RO" => "Europe/Bucharest",
        "BG" => "Europe/Sofia",
        "HR" => "Europe/Zagreb",
        "SK" => "Europe/Bratislava",
        "NO" => "Europe/Oslo",
        "FI" => "Europe/Helsinki",
        "DK" => "Europe/Copenhagen",
        "CH" => "Europe/Zurich",
        "AT" => "Europe/Vienna",
        "BE" => "Europe/Brussels",
        "GR" => "Europe/Athens",
        "IL" => "Asia/Jerusalem",
        "EG" => "Africa/Cairo",
        "ZA" => "Africa/Johannesburg",
        "NG" => "Africa/Lagos",
        "NZ" => "Pacific/Auckland",
        _ => return None,
    };
    Some(value.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn known_countries_return_language() {
        for code in [
            "CN", "TW", "HK", "JP", "KR", "DE", "FR", "GB", "US", "CA", "AU", "SG",
        ] {
            assert!(
                default_language_for_country(code).is_some(),
                "missing language for {code}"
            );
        }
    }

    #[test]
    fn known_countries_return_timezone() {
        for code in [
            "CN", "TW", "HK", "JP", "KR", "DE", "FR", "GB", "US", "CA", "AU", "SG",
        ] {
            assert!(
                default_timezone_for_country(code).is_some(),
                "missing timezone for {code}"
            );
        }
    }

    #[test]
    fn unknown_country_returns_none() {
        assert!(default_language_for_country("ZZ").is_none());
        assert!(default_timezone_for_country("ZZ").is_none());
    }

    #[test]
    fn case_insensitive() {
        assert_eq!(
            default_language_for_country("cn"),
            Some("zh-CN".to_string())
        );
        assert_eq!(
            default_timezone_for_country("jp"),
            Some("Asia/Tokyo".to_string())
        );
    }
}
