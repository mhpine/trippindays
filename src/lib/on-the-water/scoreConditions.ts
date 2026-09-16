export type WaterActivity =
  | "Surfing"
  | "Personal Water Craft"
  | "Fishing"
  | "Kayak / Paddle"
  | "Sailing";

type WeatherData = {
  temperatureF: number | null;
  feelsLikeF: number | null;
  description: string;
  windSpeedMph: number | null;
  windGustMph: number | null;
  windDirection: string | null;
};

type MarineData = {
  waveHeightFt: number | null;
  waveDirection: string | null;
  wavePeriodSeconds: number | null;

  swellHeightFt: number | null;
  swellDirection: string | null;
  swellPeriodSeconds: number | null;

  waterTemperatureF: number | null;

  currentSpeedMph: number | null;
  currentDirection: string | null;

  seaLevelHeightFt: number | null;
  tideTrend: string;
};

export type ConditionsScore = {
  score: number;
  label: string;
  confidence: "High" | "Medium" | "Low";
  reasons: string[];
  warnings: string[];
};

type ScoreInput = {
  activity: WaterActivity;
  skill: string;
  weather: WeatherData;
  marine: MarineData | null;
  marineAvailable: boolean;
};

type WeightedScore = {
  score: number | null;
  weight: number;
};

function clamp(value: number) {
  return Math.max(0, Math.min(100, value));
}

function lowerIsBetter(
  value: number | null,
  idealMax: number,
  badAt: number
) {
  if (value === null) return null;

  if (value <= idealMax) return 100;
  if (value >= badAt) return 0;

  const range = badAt - idealMax;
  const amountOver = value - idealMax;

  return clamp(
    100 - (amountOver / range) * 100
  );
}

function targetRange(
  value: number | null,
  minimum: number,
  maximum: number,
  tolerance: number
) {
  if (value === null) return null;

  if (
    value >= minimum &&
    value <= maximum
  ) {
    return 100;
  }

  if (value < minimum) {
    const difference = minimum - value;

    if (difference >= tolerance) {
      return 0;
    }

    return clamp(
      100 -
        (difference / tolerance) * 100
    );
  }

  const difference = value - maximum;

  if (difference >= tolerance) {
    return 0;
  }

  return clamp(
    100 -
      (difference / tolerance) * 100
  );
}

function comfortTemperature(
  value: number | null,
  goodAt: number,
  poorAt: number
) {
  if (value === null) return null;

  if (value >= goodAt) return 100;
  if (value <= poorAt) return 20;

  return clamp(
    20 +
      ((value - poorAt) /
        (goodAt - poorAt)) *
        80
  );
}

function weatherScore(
  description: string
) {
  const text =
    description.toLowerCase();

  if (text.includes("thunder")) {
    return 0;
  }

  if (
    text.includes("snow") ||
    text.includes("heavy")
  ) {
    return 25;
  }

  if (
    text.includes("rain") ||
    text.includes("shower")
  ) {
    return 55;
  }

  if (
    text.includes("fog")
  ) {
    return 50;
  }

  if (
    text.includes("overcast")
  ) {
    return 80;
  }

  return 100;
}

function weightedAverage(
  values: WeightedScore[]
) {
  const totalPossibleWeight =
    values.reduce(
      (sum, item) =>
        sum + item.weight,
      0
    );

  const available =
    values.filter(
      (item) => item.score !== null
    );

  const availableWeight =
    available.reduce(
      (sum, item) =>
        sum + item.weight,
      0
    );

  if (!availableWeight) {
    return {
      score: 0,
      coverage: 0,
    };
  }

  const weightedTotal =
    available.reduce(
      (sum, item) =>
        sum +
        (item.score ?? 0) *
          item.weight,
      0
    );

  return {
    score: Math.round(
      weightedTotal /
        availableWeight
    ),

    coverage:
      availableWeight /
      totalPossibleWeight,
  };
}

function ratingLabel(
  score: number
) {
  if (score >= 90)
    return "Excellent";

  if (score >= 80)
    return "Great";

  if (score >= 70)
    return "Good";

  if (score >= 55)
    return "Fair";

  if (score >= 40)
    return "Poor";

  return "Use Caution";
}

function confidenceLabel(
  coverage: number
): "High" | "Medium" | "Low" {
  if (coverage >= 0.8)
    return "High";

  if (coverage >= 0.55)
    return "Medium";

  return "Low";
}

function surfingWaveRange(
  skill: string
) {
  switch (skill) {
    case "Beginner":
      return {
        min: 1,
        max: 3,
      };

    case "Advanced":
      return {
        min: 3,
        max: 9,
      };

    case "Expert":
      return {
        min: 4,
        max: 12,
      };

    default:
      return {
        min: 2,
        max: 6,
      };
  }
}

function sailingWindRange(
  skill: string
) {
  switch (skill) {
    case "Beginner":
      return {
        min: 5,
        max: 14,
      };

    case "Advanced":
      return {
        min: 10,
        max: 22,
      };

    case "Expert":
      return {
        min: 12,
        max: 26,
      };

    default:
      return {
        min: 7,
        max: 18,
      };
  }
}

export function scoreConditions({
  activity,
  skill,
  weather,
  marine,
  marineAvailable,
}: ScoreInput): ConditionsScore {
  const reasons: string[] = [];
  const warnings: string[] = [];

  let scores: WeightedScore[] = [];

  const wave =
    marine?.waveHeightFt ?? null;

  const wavePeriod =
    marine?.wavePeriodSeconds ??
    null;

  const swell =
    marine?.swellHeightFt ?? null;

  const swellPeriod =
    marine?.swellPeriodSeconds ??
    null;

  const waterTemp =
    marine?.waterTemperatureF ??
    null;

  const wind =
    weather.windSpeedMph;

  const gusts =
    weather.windGustMph;

  /*
  ---------------------------------------
  SURFING
  ---------------------------------------
  */

  if (activity === "Surfing") {
    const range =
      surfingWaveRange(skill);

    scores = [
      {
        score: targetRange(
          wave,
          range.min,
          range.max,
          4
        ),
        weight: 30,
      },

      {
        score: targetRange(
          swellPeriod,
          9,
          17,
          7
        ),
        weight: 25,
      },

      {
        score: lowerIsBetter(
          wind,
          8,
          25
        ),
        weight: 20,
      },

      {
        score: targetRange(
          swell,
          range.min,
          range.max,
          5
        ),
        weight: 15,
      },

      {
        score:
          weatherScore(
            weather.description
          ),
        weight: 5,
      },

      {
        score:
          comfortTemperature(
            waterTemp,
            65,
            45
          ),
        weight: 5,
      },
    ];

    if (
      wave !== null &&
      wave >= range.min &&
      wave <= range.max
    ) {
      reasons.push(
        `${wave} ft waves fit your ${skill.toLowerCase()} level.`
      );
    }

    if (
      swellPeriod !== null &&
      swellPeriod >= 10
    ) {
      reasons.push(
        `${swellPeriod}-second swell period looks promising.`
      );
    }

    if (
      wind !== null &&
      wind <= 10
    ) {
      reasons.push(
        `Light ${wind} mph wind should help conditions.`
      );
    }

    /*
      We don't yet know each beach's shoreline
      orientation, so wind direction is not
      being called offshore/onshore yet.
    */
  }

  /*
  ---------------------------------------
  PERSONAL WATER CRAFT
  ---------------------------------------
  */

  if (
    activity ===
    "Personal Water Craft"
  ) {
    scores = [
      {
        score: lowerIsBetter(
          wave,
          1.5,
          5
        ),
        weight: 35,
      },

      {
        score: lowerIsBetter(
          wind,
          12,
          28
        ),
        weight: 30,
      },

      {
        score: lowerIsBetter(
          gusts,
          18,
          35
        ),
        weight: 15,
      },

      {
        score:
          weatherScore(
            weather.description
          ),
        weight: 15,
      },

      {
        score:
          comfortTemperature(
            waterTemp,
            65,
            45
          ),
        weight: 5,
      },
    ];

    if (
      wave !== null &&
      wave <= 2
    ) {
      reasons.push(
        `${wave} ft waves should make for relatively smooth riding.`
      );
    }

    if (
      wind !== null &&
      wind <= 12
    ) {
      reasons.push(
        `${wind} mph wind is favorable for PWC riding.`
      );
    }
  }

  /*
  ---------------------------------------
  FISHING
  ---------------------------------------
  */

  if (activity === "Fishing") {
    scores = [
      {
        score: lowerIsBetter(
          wind,
          12,
          30
        ),
        weight: 30,
      },

      {
        score: lowerIsBetter(
          wave,
          3,
          7
        ),
        weight: 20,
      },

      {
        score: lowerIsBetter(
          gusts,
          20,
          35
        ),
        weight: 15,
      },

      {
        score:
          weatherScore(
            weather.description
          ),
        weight: 15,
      },

      {
        score:
          waterTemp === null
            ? null
            : 75,
        weight: 10,
      },

      {
        score:
          marine?.tideTrend &&
          marine.tideTrend !==
            "Unavailable"
            ? 80
            : null,
        weight: 10,
      },
    ];

    if (
      wind !== null &&
      wind <= 12
    ) {
      reasons.push(
        `Manageable ${wind} mph wind should help fishing conditions.`
      );
    }

    if (
      marine?.tideTrend &&
      marine.tideTrend !==
        "Unavailable"
    ) {
      reasons.push(
        `${marine.tideTrend} tide information is available.`
      );
    }

    if (waterTemp !== null) {
      reasons.push(
        `Water temperature is ${waterTemp}°F.`
      );
    }
  }

  /*
  ---------------------------------------
  KAYAK / PADDLE
  ---------------------------------------
  */

  if (
    activity ===
    "Kayak / Paddle"
  ) {
    scores = [
      {
        score: lowerIsBetter(
          wind,
          7,
          18
        ),
        weight: 35,
      },

      {
        score: lowerIsBetter(
          wave,
          0.75,
          3
        ),
        weight: 30,
      },

      {
        score: lowerIsBetter(
          gusts,
          12,
          25
        ),
        weight: 15,
      },

      {
        score:
          weatherScore(
            weather.description
          ),
        weight: 10,
      },

      {
        score:
          comfortTemperature(
            waterTemp,
            65,
            45
          ),
        weight: 10,
      },
    ];

    if (
      wind !== null &&
      wind <= 8
    ) {
      reasons.push(
        `Light ${wind} mph wind favors paddling.`
      );
    }

    if (
      wave !== null &&
      wave <= 1
    ) {
      reasons.push(
        `Very light ${wave} ft wave conditions.`
      );
    }
  }

  /*
  ---------------------------------------
  SAILING
  ---------------------------------------
  */

  if (activity === "Sailing") {
    const range =
      sailingWindRange(skill);

    scores = [
      {
        score: targetRange(
          wind,
          range.min,
          range.max,
          12
        ),
        weight: 45,
      },

      {
        score: lowerIsBetter(
          gusts,
          range.max + 5,
          40
        ),
        weight: 20,
      },

      {
        score: lowerIsBetter(
          wave,
          skill === "Beginner"
            ? 2
            : 4,
          skill === "Beginner"
            ? 5
            : 8
        ),
        weight: 20,
      },

      {
        score:
          weatherScore(
            weather.description
          ),
        weight: 15,
      },
    ];

    if (
      wind !== null &&
      wind >= range.min &&
      wind <= range.max
    ) {
      reasons.push(
        `${wind} mph wind falls in a useful range for ${skill.toLowerCase()} sailing.`
      );
    }

    if (
      weather.windDirection
    ) {
      reasons.push(
        `Wind is currently from the ${weather.windDirection}.`
      );
    }
  }

  /*
  ---------------------------------------
  CALCULATE SCORE
  ---------------------------------------
  */

  const result =
    weightedAverage(scores);

  let finalScore =
    result.score;

  /*
  ---------------------------------------
  SAFETY WARNINGS / CAPS
  ---------------------------------------
  */

  const description =
    weather.description.toLowerCase();

  if (
    description.includes(
      "thunder"
    )
  ) {
    warnings.push(
      "Thunderstorms are reported. Water activities should be avoided."
    );

    finalScore =
      Math.min(finalScore, 20);
  }

  if (
    gusts !== null &&
    gusts >= 30
  ) {
    warnings.push(
      `Strong gusts around ${gusts} mph may create hazardous conditions.`
    );

    finalScore =
      Math.min(finalScore, 45);
  }

  if (
    activity ===
      "Kayak / Paddle" &&
    wave !== null &&
    wave >= 3
  ) {
    warnings.push(
      `${wave} ft waves may be difficult for paddling.`
    );

    finalScore =
      Math.min(finalScore, 40);
  }

  if (
    activity ===
      "Personal Water Craft" &&
    wave !== null &&
    wave >= 5
  ) {
    warnings.push(
      `${wave} ft waves could make PWC riding rough or unsafe.`
    );

    finalScore =
      Math.min(finalScore, 40);
  }

  if (
    activity === "Surfing" &&
    skill === "Beginner" &&
    wave !== null &&
    wave > 4
  ) {
    warnings.push(
      `${wave} ft waves may exceed typical beginner conditions.`
    );

    finalScore =
      Math.min(finalScore, 45);
  }

  if (
    waterTemp !== null &&
    waterTemp < 50
  ) {
    warnings.push(
      `Cold ${waterTemp}°F water increases cold-water risk.`
    );
  }

  if (!marineAvailable) {
    warnings.push(
      "Marine model data is limited for this location."
    );
  }

  if (!reasons.length) {
    reasons.push(
      "Score is based on the available weather and water data."
    );
  }

  return {
    score:
      Math.round(finalScore),

    label:
      ratingLabel(finalScore),

    confidence:
      confidenceLabel(
        result.coverage
      ),

    reasons:
      reasons.slice(0, 3),

    warnings:
      warnings.slice(0, 3),
  };
}