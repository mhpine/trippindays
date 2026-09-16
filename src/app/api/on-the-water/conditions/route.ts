import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type AnyRecord = Record<string, unknown>;

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function metersToFeet(value: unknown): number | null {
  const n = asNumber(value);
  return n === null ? null : Math.round(n * 3.28084 * 10) / 10;
}

function cToF(value: unknown): number | null {
  const n = asNumber(value);
  return n === null ? null : Math.round((n * 9) / 5 + 32);
}

function kmhToMph(value: unknown): number | null {
  const n = asNumber(value);
  return n === null ? null : Math.round(n * 0.621371 * 10) / 10;
}

function round1(value: unknown): number | null {
  const n = asNumber(value);
  return n === null ? null : Math.round(n * 10) / 10;
}

function directionLabel(value: unknown): string | null {
  const degrees = asNumber(value);
  if (degrees === null) return null;

  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return directions[Math.round(degrees / 45) % 8];
}

function weatherDescription(codeValue: unknown): string {
  const code = asNumber(codeValue);

  if (code === null) return "Current conditions";
  if (code === 0) return "Clear";
  if (code === 1) return "Mostly clear";
  if (code === 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code === 45 || code === 48) return "Fog";
  if ([51, 53, 55, 56, 57].includes(code)) return "Drizzle";
  if ([61, 63, 65, 66, 67].includes(code)) return "Rain";
  if ([71, 73, 75, 77].includes(code)) return "Snow";
  if ([80, 81, 82].includes(code)) return "Rain showers";
  if ([85, 86].includes(code)) return "Snow showers";
  if ([95, 96, 99].includes(code)) return "Thunderstorms";

  return "Current conditions";
}

function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusMiles = 3958.8;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  return Math.round(earthRadiusMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

function tideTrend(currentLevel: unknown, hourlyLevels: unknown): string {
  const current = asNumber(currentLevel);

  if (!Array.isArray(hourlyLevels) || hourlyLevels.length < 2) {
    return "Unavailable";
  }

  const numeric = hourlyLevels
    .map(asNumber)
    .filter((value): value is number => value !== null);

  if (numeric.length < 2) return "Unavailable";

  const start = current ?? numeric[0];
  const future = numeric[Math.min(2, numeric.length - 1)];
  const change = future - start;

  if (change > 0.03) return "Rising";
  if (change < -0.03) return "Falling";
  return "Steady";
}

async function fetchJson(url: string) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Upstream request failed with ${response.status}`);
  }

  return (await response.json()) as AnyRecord;
}

export async function GET(request: NextRequest) {
  try {
    const latParam = request.nextUrl.searchParams.get("lat");
    const lonParam = request.nextUrl.searchParams.get("lon");

    const latitude = Number(latParam);
    const longitude = Number(lonParam);

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return NextResponse.json(
        { success: false, error: "Valid lat and lon values are required." },
        { status: 400 }
      );
    }

    const weatherUrl = new URL("https://api.open-meteo.com/v1/forecast");
    weatherUrl.searchParams.set("latitude", String(latitude));
    weatherUrl.searchParams.set("longitude", String(longitude));
    weatherUrl.searchParams.set(
      "current",
      [
        "temperature_2m",
        "apparent_temperature",
        "weather_code",
        "wind_speed_10m",
        "wind_gusts_10m",
        "wind_direction_10m",
      ].join(",")
    );
    weatherUrl.searchParams.set("daily", "sunrise,sunset");
    weatherUrl.searchParams.set("temperature_unit", "fahrenheit");
    weatherUrl.searchParams.set("wind_speed_unit", "mph");
    weatherUrl.searchParams.set("timezone", "auto");
    weatherUrl.searchParams.set("forecast_days", "2");

    const weatherData = await fetchJson(weatherUrl.toString());
    const weatherCurrent = (weatherData.current as AnyRecord | undefined) ?? {};
    const weatherDaily = (weatherData.daily as AnyRecord | undefined) ?? {};

    let marineAvailable = false;
    let marineCurrent: AnyRecord | null = null;
    let marineHourly: AnyRecord | null = null;
    let marineLatitude: number | null = null;
    let marineLongitude: number | null = null;

    try {
      const marineUrl = new URL("https://marine-api.open-meteo.com/v1/marine");
      marineUrl.searchParams.set("latitude", String(latitude));
      marineUrl.searchParams.set("longitude", String(longitude));
      marineUrl.searchParams.set(
        "current",
        [
          "wave_height",
          "wave_direction",
          "wave_period",
          "swell_wave_height",
          "swell_wave_direction",
          "swell_wave_period",
          "sea_surface_temperature",
          "ocean_current_velocity",
          "ocean_current_direction",
          "sea_level_height_msl",
        ].join(",")
      );
      marineUrl.searchParams.set(
        "hourly",
        [
          "wave_height",
          "wave_direction",
          "wave_period",
          "swell_wave_height",
          "swell_wave_direction",
          "swell_wave_period",
          "sea_surface_temperature",
          "sea_level_height_msl",
        ].join(",")
      );
      marineUrl.searchParams.set("forecast_hours", "12");
      marineUrl.searchParams.set("timezone", "auto");
      marineUrl.searchParams.set("cell_selection", "sea");

      const marineData = await fetchJson(marineUrl.toString());

      marineCurrent = (marineData.current as AnyRecord | undefined) ?? null;
      marineHourly = (marineData.hourly as AnyRecord | undefined) ?? null;
      marineLatitude = asNumber(marineData.latitude);
      marineLongitude = asNumber(marineData.longitude);

      marineAvailable =
        !!marineCurrent &&
        [
          marineCurrent.wave_height,
          marineCurrent.swell_wave_height,
          marineCurrent.sea_surface_temperature,
          marineCurrent.sea_level_height_msl,
        ].some((value) => asNumber(value) !== null);
    } catch (marineError) {
      console.warn("Marine conditions unavailable:", marineError);
    }

    const hourlyTimes = Array.isArray(marineHourly?.time) ? marineHourly.time : [];
    const hourlyWaveHeight = Array.isArray(marineHourly?.wave_height) ? marineHourly.wave_height : [];
    const hourlyWavePeriod = Array.isArray(marineHourly?.wave_period) ? marineHourly.wave_period : [];
    const hourlyWaveDirection = Array.isArray(marineHourly?.wave_direction) ? marineHourly.wave_direction : [];
    const hourlySwellHeight = Array.isArray(marineHourly?.swell_wave_height) ? marineHourly.swell_wave_height : [];
    const hourlySwellPeriod = Array.isArray(marineHourly?.swell_wave_period) ? marineHourly.swell_wave_period : [];
    const hourlyWaterTemp = Array.isArray(marineHourly?.sea_surface_temperature) ? marineHourly.sea_surface_temperature : [];
    const hourlySeaLevel = Array.isArray(marineHourly?.sea_level_height_msl) ? marineHourly.sea_level_height_msl : [];

    const next12Hours = hourlyTimes.slice(0, 12).map((time, index) => ({
      time: String(time),
      waveHeightFt: metersToFeet(hourlyWaveHeight[index]),
      wavePeriodSeconds: round1(hourlyWavePeriod[index]),
      waveDirection: directionLabel(hourlyWaveDirection[index]),
      swellHeightFt: metersToFeet(hourlySwellHeight[index]),
      swellPeriodSeconds: round1(hourlySwellPeriod[index]),
      waterTemperatureF: cToF(hourlyWaterTemp[index]),
    }));

    const currentSeaLevel = marineCurrent?.sea_level_height_msl;

    return NextResponse.json({
      success: true,
      updatedAt: new Date().toISOString(),
      weather: {
        current: {
          temperatureF: round1(weatherCurrent.temperature_2m),
          feelsLikeF: round1(weatherCurrent.apparent_temperature),
          description: weatherDescription(weatherCurrent.weather_code),
          windSpeedMph: round1(weatherCurrent.wind_speed_10m),
          windGustMph: round1(weatherCurrent.wind_gusts_10m),
          windDirection: directionLabel(weatherCurrent.wind_direction_10m),
        },
        daily: {
          sunrise: Array.isArray(weatherDaily.sunrise) ? weatherDaily.sunrise : [],
          sunset: Array.isArray(weatherDaily.sunset) ? weatherDaily.sunset : [],
        },
      },
      marine: {
        available: marineAvailable,
        modelPoint: {
          latitude: marineLatitude,
          longitude: marineLongitude,
          distanceMiles:
            marineLatitude !== null && marineLongitude !== null
              ? haversineMiles(latitude, longitude, marineLatitude, marineLongitude)
              : null,
        },
        current:
          marineAvailable && marineCurrent
            ? {
                waveHeightFt: metersToFeet(marineCurrent.wave_height),
                waveDirection: directionLabel(marineCurrent.wave_direction),
                wavePeriodSeconds: round1(marineCurrent.wave_period),
                swellHeightFt: metersToFeet(marineCurrent.swell_wave_height),
                swellDirection: directionLabel(marineCurrent.swell_wave_direction),
                swellPeriodSeconds: round1(marineCurrent.swell_wave_period),
                waterTemperatureF: cToF(marineCurrent.sea_surface_temperature),
                currentSpeedMph: kmhToMph(marineCurrent.ocean_current_velocity),
                currentDirection: directionLabel(marineCurrent.ocean_current_direction),
                seaLevelHeightFt: metersToFeet(currentSeaLevel),
                tideTrend: tideTrend(currentSeaLevel, hourlySeaLevel),
              }
            : null,
        next12Hours,
      },
    });
  } catch (error) {
    console.error("On the Water conditions route error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to load water conditions.",
      },
      { status: 500 }
    );
  }
}
