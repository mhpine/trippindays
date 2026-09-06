"use client";



import { useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import {
  DuffelCardForm,
  createThreeDSecureSession,
  useDuffelCardFormActions,
} from "@duffel/components";

type AdventureOption = {
  name: string;
  region: string;
  emoji: string; 
  matchScore: number;
  estimatedDriveTime: string;
  estimatedDistance: string;
  estimatedCost: number;
  reason: string;
};

type LiveChecks = {
  checkedAt: string;
  location: string;
  latitude: number;
  longitude: number;
  temperature: number | null;
  feelsLike: number | null;
  windSpeed: number | null;
  precipitation: number | null;
  weatherCode: number | null;
  high: number | null;
  low: number | null;
  rainChance: number | null;
  uvIndex: number | null;
sunset: string | null;
windGusts: number | null;
moonPhase: string | null;
alerts: string[];
};

type Section = {
  title: string;
  emoji: string;
  lines: string[];
  navigationQuery: string | null;

  researchUrl?: string | null;
  mapsUrl?: string | null;
  trailUrl?: string | null;
  ticketUrl?: string | null;
};
type BudgetBreakdown = {
  fuel: number;
  food: number;
  activities: number;
  parking: number;
  lodging: number;
  transportation: number;
  other: number;
  total: number;
};

type TripExpenseCategory =
  | "Flights"
  | "Train / Bus"
  | "Lodging"
  | "Rental Car"
  | "Activities"
  | "Fuel"
  | "Food"
  | "Parking"
  | "Other";

type TripExpense = {
  id: string;
  category: TripExpenseCategory;
  amount: number;
  currency: string;
  label: string;
  source: string;
  testMode: boolean;
  createdAt: string;
};

type OvernightStop = {
  stage: string;
  location: string;
  dayNumber: number | null;
  checkIn: string;
  checkOut: string;
};

type DetourStop = {
  name: string;
  area: string;
  detourTime: string;
  detourMiles: string;
  reason: string;
};

type FlightOffer = {
  id: string;
  totalAmount: string;
  totalCurrency: string;
  airline: string;
  airlineLogo: string | null;
  operatingCarriers: string[];

  origin: string;
  destination: string;
  departureTime: string | null;
  arrivalTime: string | null;
  duration: string | null;
  stops: number;

  returnOrigin: string | null;
  returnDestination: string | null;
  returnDepartureTime: string | null;
  returnArrivalTime: string | null;
  returnDuration: string | null;
  returnStops: number | null;

  expiresAt: string | null;
};

type FlightCheckoutPassenger = {
  id: string;
  type: string;
};

type FlightPassengerForm = {
  id: string;
  title: "mr" | "mrs" | "ms" | "miss" | "dr";
  givenName: string;
  familyName: string;
  bornOn: string;
  gender: "m" | "f";
  email: string;
  phoneNumber: string;
};

type FlightCheckoutOffer = {
  id: string;
  totalAmount: string;
  totalCurrency: string;
  expiresAt: string | null;
  liveMode: boolean;
  passengers: FlightCheckoutPassenger[];
};

type FlightOrderConfirmation = {
  id: string;
  bookingReference: string;
  totalAmount: string;
  totalCurrency: string;
  passengerCount: number;
  airline: string;
  liveMode: boolean;
};


function normalizePhoneForDuffel(value: string): string {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");

  if (!digits) return "";

  if (trimmed.startsWith("+")) {
    return `+${digits}`;
  }

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  return `+${digits}`;
}

function formatPhoneForDisplay(value: string): string {
  const digits = value.replace(/\D/g, "");
  const localDigits =
    digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;

  if (localDigits.length === 10) {
    return `(${localDigits.slice(0, 3)}) ${localDigits.slice(3, 6)}-${localDigits.slice(6)}`;
  }

  return value;
}


export default function TripPage() {
  const [request, setRequest] = useState("");
  const budget = getValue(request, "Budget") || "Not specified";
 const [aiPlan, setAiPlan] = useState ("");
  const [tripTitle, setTripTitle] = useState("");
  const [destination, setDestination] = useState("");
  const [imageSearchQuery, setImageSearchQuery] = useState("");
  const [imageUrl, setImageUrl] = useState("");
const [photographer, setPhotographer] = useState("");
const [photographerUrl, setPhotographerUrl] = useState("");
const [pexelsUrl, setPexelsUrl] = useState("");
  const [summary, setSummary] = useState("");
  const [roundTripMiles, setRoundTripMiles] = useState<number | null>(null);
  const [budgetBreakdown, setBudgetBreakdown] = useState<BudgetBreakdown | null>(null);
  const [tripExpenses, setTripExpenses] = useState<TripExpense[]>([]);
  const [currentSavedTripId, setCurrentSavedTripId] = useState<string | null>(null);
  const budgetItems = budgetBreakdown
  ? [
      { label: "Fuel", value: budgetBreakdown.fuel },
      { label: "Food", value: budgetBreakdown.food },
      { label: "Activities", value: budgetBreakdown.activities },
      { label: "Parking", value: budgetBreakdown.parking },
      { label: "Lodging", value: budgetBreakdown.lodging },
      { label: "Transportation", value: budgetBreakdown.transportation },
      { label: "Other", value: budgetBreakdown.other },
    ]
  : [];


  const tripExpenseStorageKey = useMemo(() => {
    const source = request || "unsaved-trip";
    let hash = 0;
    for (let index = 0; index < source.length; index += 1) {
      hash = (hash * 31 + source.charCodeAt(index)) >>> 0;
    }
    return `trippindays-trip-expenses-${hash.toString(16)}`;
  }, [request]);

  const actualTripExpenses = useMemo(
    () => tripExpenses.filter((expense) => !expense.testMode),
    [tripExpenses]
  );

  const testTripExpenses = useMemo(
    () => tripExpenses.filter((expense) => expense.testMode),
    [tripExpenses]
  );

  const displayTripExpenses =
    actualTripExpenses.length > 0 ? actualTripExpenses : testTripExpenses;

  const tripSpentTotal = displayTripExpenses.reduce(
    (sum, expense) => sum + expense.amount,
    0
  );

  const numericTripBudget = Number(
    String(budget || "").replace(/[^0-9.]/g, "")
  );

  const remainingTripBudget =
    Number.isFinite(numericTripBudget) && numericTripBudget > 0
      ? Math.max(numericTripBudget - tripSpentTotal, 0)
      : null;

  const spendingByCategory = displayTripExpenses.reduce<Record<string, number>>(
    (totals, expense) => {
      totals[expense.category] = (totals[expense.category] || 0) + expense.amount;
      return totals;
    },
    {}
  );

  function recordTripExpense(expense: TripExpense) {
    setTripExpenses((current) => {
      if (current.some((item) => item.id === expense.id)) return current;

      const next = [...current, expense];

      // Unsaved-trip spending stays in React state only.
      // Saved-trip spending is persisted in Supabase by trip_id.
      return next;
    });

    if (currentSavedTripId && user) {
      const supabase = createClient();

      void (async () => {
        const { data: existing, error: lookupError } = await supabase
          .from("trip_expenses")
          .select("id")
          .eq("trip_id", currentSavedTripId)
          .eq("user_id", user.id)
          .eq("expense_key", expense.id)
          .maybeSingle();

        if (lookupError) {
          console.error("Could not check saved trip expense:", lookupError);
          return;
        }

        if (existing) return;

        const { error: insertError } = await supabase
          .from("trip_expenses")
          .insert({
            trip_id: currentSavedTripId,
            user_id: user.id,
            expense_key: expense.id,
            category: expense.category,
            label: expense.label,
            amount: expense.amount,
            currency: expense.currency || "USD",
            source: expense.source || "TrippinDays",
            test_mode: expense.testMode,
            spent_at: expense.createdAt || new Date().toISOString(),
          });

        if (insertError) {
          console.error(
            "TRIP EXPENSE DIRECT INSERT ERROR:",
            "message =", insertError.message,
            "code =", insertError.code,
            "details =", insertError.details,
            "hint =", insertError.hint
          );
        }
      })();
    }
  }

  const [whySelected, setWhySelected] = useState<string[]>([]); 
  const [musicSuggestions, setMusicSuggestions] = useState<
  { title: string; artist: string; reason: string }[]
>([]);
  const [adventures, setAdventures] = useState<AdventureOption[]>([]);
  const [liveChecks, setLiveChecks] = useState<LiveChecks | null>(null);
  const [nearbyEvents, setNearbyEvents] = useState<any[]>([]);
  const [detourStops, setDetourStops] = useState<DetourStop[]>([]);
const [eventsLoading, setEventsLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [showSectionSkip, setShowSectionSkip] = useState(true);
  const [showSectionBack, setShowSectionBack] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
 const [isRemixing, setIsRemixing] = useState("");
const [selectedRemixes, setSelectedRemixes] = useState<string[]>([]);
const [remixCount, setRemixCount] = useState(0);
const MAX_REMIXES = 2;
  const [recentDestinations, setRecentDestinations] = useState<string[]>([]);
 

useEffect(() => {
  const params = new URLSearchParams(window.location.search);

  // Saved trips load their own spending from Supabase.
  if (params.get("savedTrip")) return;

  // Every new/unsaved trip starts clean.
  setTripExpenses([]);
  setCurrentSavedTripId(null);
}, [request]);

useEffect(() => {
  if (!imageSearchQuery) return;

  async function loadPhoto() {
    try {
      const response = await fetch(
        `/api/photo?query=${encodeURIComponent(imageSearchQuery)}`
      );

      if (!response.ok) return;

      const data = await response.json();

      setImageUrl(data.imageUrl || "");
      setPhotographer(data.photographer || "");
      setPhotographerUrl(data.photographerUrl || "");
      setPexelsUrl(data.pexelsUrl || "");
    } catch (error) {
      console.error("Photo load failed:", error);
    }
  }

  void loadPhoto();
}, [imageSearchQuery]);


  function toggleRemix(type: string) {
  setSelectedRemixes((current) =>
    current.includes(type)
      ? current.filter((item) => item !== type)
      : [...current, type]
  );
}
useEffect(() => {
  const saved = localStorage.getItem("trippindays-recent-destinations");

  if (saved) {
    try {
      setRecentDestinations(JSON.parse(saved));
    } catch {
      setRecentDestinations([]);
    }
  }
}, []);
  const started = useRef(false);
const [user, setUser] = useState<User | null>(null);
const [isPremium, setIsPremium] = useState(false);
useEffect(() => {
  const supabase = createClient();

 supabase.auth.getUser().then(async ({ data }) => {
  const currentUser = data.user ?? null;
  setUser(currentUser);

  if (!currentUser) {
    setIsPremium(false);
    return;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_premium")
    .eq("id", currentUser.id)
    .single();

  setIsPremium(profile?.is_premium === true);
});

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    setUser(session?.user ?? null);
  });

  return () => {
    subscription.unsubscribe();
  };
}, []);
useEffect(() => {
  const supabase = createClient();

  async function checkPremium() {
    if (!user) {
      setIsPremium(false);
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("is_premium")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Premium check failed:", error);
      setIsPremium(false);
      return;
    }

    setIsPremium(data?.is_premium === true);
  }

  void checkPremium();
}, [user]);
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const savedTripId = params.get("savedTrip");

  async function loadTripPage() {
    // Opening a saved trip must display the exact itinerary that was saved.
    // Do NOT send it back through /api/plan, because that would generate a
    // different itinerary.
    if (savedTripId) {
      const supabase = createClient();

      try {
        setIsLoading(true);
        setError("");

        const { data: { user: currentUser }, error: userError } =
          await supabase.auth.getUser();

        if (userError || !currentUser) {
          setError("Sign in to view your saved trip.");
          return;
        }

        const { data: savedTrip, error: savedTripError } = await supabase
          .from("trips")
          .select(
            "id, user_id, title, starting_location, destination, image_url, budget, time_available, travelers, trip_request, itinerary, trip_snapshot, status, created_at"
          )
          .eq("id", savedTripId)
          .eq("user_id", currentUser.id)
          .single();

        if (savedTripError || !savedTrip) {
          throw savedTripError || new Error("Saved trip not found.");
        }

        setCurrentSavedTripId(savedTrip.id);

        const snapshot =
          savedTrip.trip_snapshot &&
          typeof savedTrip.trip_snapshot === "object" &&
          !Array.isArray(savedTrip.trip_snapshot)
            ? (savedTrip.trip_snapshot as Record<string, any>)
            : {};

        const savedRequest = savedTrip.trip_request || "";
        const frozenPlan =
          typeof snapshot.aiPlan === "string" && snapshot.aiPlan.trim()
            ? snapshot.aiPlan
            : savedTrip.itinerary || "";

        setRequest(
          typeof snapshot.request === "string" && snapshot.request.trim()
            ? snapshot.request
            : savedRequest
        );
        setAiPlan(frozenPlan);
        setDetourStops(
          Array.isArray(snapshot.detourStops)
            ? snapshot.detourStops
            : parseDetourStops(frozenPlan)
        );
        setTripTitle(
          typeof snapshot.tripTitle === "string" && snapshot.tripTitle.trim()
            ? snapshot.tripTitle
            : savedTrip.title || "Your TrippinDays Adventure"
        );
        setDestination(
          typeof snapshot.destination === "string" && snapshot.destination.trim()
            ? snapshot.destination
            : savedTrip.destination || ""
        );
        setImageSearchQuery(
          typeof snapshot.imageSearchQuery === "string"
            ? snapshot.imageSearchQuery
            : ""
        );
        setImageUrl(
          typeof snapshot.imageUrl === "string" && snapshot.imageUrl
            ? snapshot.imageUrl
            : savedTrip.image_url || ""
        );
        setPhotographer(
          typeof snapshot.photographer === "string" ? snapshot.photographer : ""
        );
        setPhotographerUrl(
          typeof snapshot.photographerUrl === "string"
            ? snapshot.photographerUrl
            : ""
        );
        setPexelsUrl(
          typeof snapshot.pexelsUrl === "string" ? snapshot.pexelsUrl : ""
        );
        setSummary(typeof snapshot.summary === "string" ? snapshot.summary : "");
        setRoundTripMiles(
          typeof snapshot.roundTripMiles === "number"
            ? snapshot.roundTripMiles
            : null
        );
        setBudgetBreakdown(
          snapshot.budgetBreakdown &&
          typeof snapshot.budgetBreakdown === "object"
            ? {
                ...snapshot.budgetBreakdown,
                transportation:
                  typeof snapshot.budgetBreakdown.transportation === "number"
                    ? snapshot.budgetBreakdown.transportation
                    : 0,
              }
            : null
        );
        setWhySelected(
          Array.isArray(snapshot.whySelected) ? snapshot.whySelected : []
        );
        setAdventures(
          Array.isArray(snapshot.adventures) ? snapshot.adventures : []
        );
        setMusicSuggestions(
          Array.isArray(snapshot.musicSuggestions)
            ? snapshot.musicSuggestions
            : []
        );
        setLiveChecks(
          snapshot.liveChecks && typeof snapshot.liveChecks === "object"
            ? snapshot.liveChecks
            : null
        );

        const { data: savedExpenses, error: expensesError } = await supabase
          .from("trip_expenses")
          .select(
            "id, expense_key, category, label, amount, currency, source, test_mode, spent_at"
          )
          .eq("trip_id", savedTrip.id)
          .eq("user_id", currentUser.id)
          .order("spent_at", { ascending: true });

        if (expensesError) {
          console.error("Could not load saved trip spending:", expensesError);
        } else {
          setTripExpenses(
            (savedExpenses || []).map((expense: any) => ({
              id: expense.expense_key || expense.id,
              category: expense.category as TripExpenseCategory,
              amount: Number(expense.amount) || 0,
              currency: expense.currency || "USD",
              label: expense.label || expense.category || "Trip expense",
              source: expense.source || "Supabase",
              testMode: expense.test_mode === true,
              createdAt: expense.spent_at || new Date().toISOString(),
            }))
          );
        }

        setSaveMessage("✅ Saved Trip");

        // Keep the exact request handy if the traveler later chooses Regenerate.
        if (savedRequest) {
          localStorage.setItem("trippindays-request", savedRequest);
        }
        return;
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not load the saved trip."
        );
        return;
      } finally {
        setIsLoading(false);
      }
    }

    const saved =
      params.get("request") ||
      localStorage.getItem("trippindays-request") ||
      "";

    setRequest(saved);

    const recentSaved =
      localStorage.getItem("trippindays-recent-destinations");

    let recentForRequest: string[] = [];
    if (recentSaved) {
      try {
        recentForRequest = JSON.parse(recentSaved);
      } catch {
        recentForRequest = [];
      }
    }

    if (!saved.trim()) {
      setError("No trip request was found. Return home and create a trip.");
      setIsLoading(false);
      return;
    }

    void buildTrip(saved, recentForRequest);
  }

  void loadTripPage();
}, []);

  const start = getValue(request, "Starting Location");
  const time = getValue(request, "Time Available") || "Not specified";
  const travelers = getValue(request, "Travelers") || "Not specified";
  const startDate = getValue(request, "Start Date") || getValue(request, "Trip Date");

  const sections = useMemo(
    () => parsePlan(aiPlan, destination),
    [aiPlan, destination]
  );

  const overnightStops = useMemo(
    () => parseOvernightStops(aiPlan, startDate, destination),
    [aiPlan, startDate, destination]
  );
useEffect(() => {
  async function loadNearbyEvents() {
    if (!liveChecks?.latitude || !liveChecks?.longitude) return;

    try {
      setEventsLoading(true);

      const response = await fetch(
        `/api/events-nearby?lat=${liveChecks.latitude}&lon=${liveChecks.longitude}&radius=75`
      );

      if (!response.ok) {
        throw new Error("Could not load nearby events.");
      }

      const data = await response.json();
console.log("NEARBY EVENT COUNT:", data.events?.length);
console.log("NEARBY EVENT DATA:", data.events);
      setNearbyEvents(Array.isArray(data.events) ? data.events : []);
    } catch (error) {
      console.error("Nearby events load failed:", error);
      setNearbyEvents([]);
    } finally {
      setEventsLoading(false);
    }
  }

  void loadNearbyEvents();
}, [liveChecks]);
  async function buildTrip(
  savedRequest: string,
  recentForRequest: string[]
) {
    try {
      setIsLoading(true);
      setError("");
      setSaveMessage("");

      const response = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
  tripRequest: savedRequest,
  recentDestinations: recentForRequest,
}),
      });

      const data = await response.json();
console.log("BUDGET BREAKDOWN:", data.budgetBreakdown);
      if (!response.ok) {
        throw new Error(data.error || "Could not build your trip.");
      }

      setAiPlan(data.plan || "");
      setDetourStops(
        Array.isArray(data.detourStops) && data.detourStops.length > 0
          ? data.detourStops.slice(0, 5)
          : parseDetourStops(data.plan || "")
      );
      setTripTitle(data.title || "Your TrippinDays Adventure");
      setDestination(data.destination || "");
      setBudgetBreakdown(
        data.budgetBreakdown
          ? {
              ...data.budgetBreakdown,
              transportation:
                typeof data.budgetBreakdown.transportation === "number"
                  ? data.budgetBreakdown.transportation
                  : 0,
            }
          : null
      );
      setImageSearchQuery(data.imageSearchQuery || "");
     if (data.destination) {
  setRecentDestinations((current) => {
  const returnedDestinations = [
    data.destination,
    ...(Array.isArray(data.adventures)
      ? data.adventures.map((item: AdventureOption) => item.name)
      : []),
  ].filter(Boolean);

  const updated = [
    ...returnedDestinations,
    ...current.filter((item) => !returnedDestinations.includes(item)),
  ].slice(0, 30);

  localStorage.setItem(
    "trippindays-recent-destinations",
    JSON.stringify(updated)
  );

  return updated;
});
}
      setSummary(data.summary || "");
      setRoundTripMiles(
  typeof data.roundTripMiles === "number"
    ? data.roundTripMiles
    : null
);
      setWhySelected(Array.isArray(data.whySelected) ? data.whySelected : []);
      setAdventures(Array.isArray(data.adventures) ? data.adventures : []);
      setMusicSuggestions(
  Array.isArray(data.musicSuggestions) ? data.musicSuggestions : []
)
      setLiveChecks(data.liveChecks || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not build your trip.");
    } finally {
      setIsLoading(false);
    }
  }

  function openAdventure(adventure: AdventureOption) {
    const nextRequest = `
Starting Location: ${start || "Use the original starting location"}
Budget: $${adventure.estimatedCost}
Time Available: ${time}
Travelers: ${travelers}

Trip Request:
Create a complete itinerary for ${adventure.name}, ${adventure.region}.
Include realistic times, mileage, parking, fees, activities, food, weather, total cost, return time, and free RoadTunes song suggestions.

Why selected:
${adventure.reason}
    `.trim();

    localStorage.setItem("trippindays-request", nextRequest);
    window.location.href = "/trip";
  }
  async function saveTrip() {
    if (isSaving) return;

    setIsSaving(true);
    setSaveMessage("");

    try {
      const supabase = createClient();
      const {
        data: { user: currentUser },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !currentUser) {
        setSaveMessage("Create a free account to save your trip.");
        return;
      }

      if (!aiPlan.trim()) {
        setSaveMessage("Build your trip before saving it.");
        return;
      }

      const rawBudget = getValue(request, "Budget");
      const numericBudget = rawBudget
        ? Number(rawBudget.replace(/[^0-9.]/g, ""))
        : null;

      const tripSnapshot = {
        version: 1,
        savedAt: new Date().toISOString(),
        request,
        aiPlan,
        tripTitle,
        destination,
        imageSearchQuery,
        imageUrl,
        photographer,
        photographerUrl,
        pexelsUrl,
        summary,
        roundTripMiles,
        budgetBreakdown,
        whySelected,
        adventures,
        musicSuggestions,
        liveChecks,
        detourStops,
      };

      const tripRow = {
        user_id: currentUser.id,
        title:
          tripTitle.trim() ||
          destination.trim() ||
          "My TrippinDays Adventure",
        starting_location: start || null,
        destination: destination.trim() || null,
        image_url: imageUrl || null,
        budget:
          numericBudget !== null && !Number.isNaN(numericBudget)
            ? numericBudget
            : null,
        time_available: getValue(request, "Time Available") || null,
        travelers: getValue(request, "Travelers") || null,
        trip_request: request,
        itinerary: aiPlan,
        trip_snapshot: tripSnapshot,
        status: "saved",
      };

      let savedTripId = currentSavedTripId;

      if (currentSavedTripId) {
        const { error: updateError } = await supabase
          .from("trips")
          .update(tripRow)
          .eq("id", currentSavedTripId)
          .eq("user_id", currentUser.id);

        if (updateError) throw updateError;
      } else {
        const { data: savedTrip, error: insertError } = await supabase
          .from("trips")
          .insert(tripRow)
          .select("id")
          .single();

        if (insertError) throw insertError;
        savedTripId = savedTrip?.id || null;
      }

      if (savedTripId) {
        setCurrentSavedTripId(savedTripId);
        localStorage.setItem("trippindays-last-saved-trip-id", savedTripId);

        if (tripExpenses.length > 0) {
          const { data: existingExpenses, error: existingExpenseError } =
            await supabase
              .from("trip_expenses")
              .select("expense_key")
              .eq("trip_id", savedTripId)
              .eq("user_id", currentUser.id);

          if (existingExpenseError) {
            console.error(
              "TRIP EXPENSE LOOKUP ERROR:",
              "message =", existingExpenseError.message,
              "code =", existingExpenseError.code,
              "details =", existingExpenseError.details,
              "hint =", existingExpenseError.hint
            );
            setSaveMessage(
              `Trip saved, but spending lookup failed: ${existingExpenseError.message}`
            );
          } else {
            const existingExpenseKeys = new Set(
              (existingExpenses || []).map((expense: any) => expense.expense_key)
            );

            const rowsToInsert = tripExpenses
              .filter((expense) => !existingExpenseKeys.has(expense.id))
              .map((expense) => ({
                trip_id: savedTripId,
                user_id: currentUser.id,
                expense_key: expense.id,
                category: expense.category,
                label: expense.label,
                amount: expense.amount,
                currency: expense.currency || "USD",
                source: expense.source || "TrippinDays",
                test_mode: expense.testMode,
                spent_at: expense.createdAt || new Date().toISOString(),
              }));

            if (rowsToInsert.length > 0) {
              const { error: expenseInsertError } = await supabase
                .from("trip_expenses")
                .insert(rowsToInsert);

              if (expenseInsertError) {
                console.error(
                  "TRIP EXPENSE INSERT ERROR:",
                  "message =", expenseInsertError.message,
                  "code =", expenseInsertError.code,
                  "details =", expenseInsertError.details,
                  "hint =", expenseInsertError.hint
                );
                setSaveMessage(
                  `Trip saved, but spending failed: ${expenseInsertError.message}`
                );
              }
            }
          }
        }
      }

      setSaveMessage((currentMessage) =>
        currentMessage.startsWith("Trip saved, but")
          ? currentMessage
          : "✅ Trip Saved!"
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "The trip could not be saved.";

      if (message.toLowerCase().includes("auth session missing")) {
        setSaveMessage("Create a free account to save your trip.");
        return;
      }

      setSaveMessage(message);
    } finally {
      setIsSaving(false);
    }
  }


 async function remixTrip(remixTypes: string[]) {
  if (!aiPlan.trim()) {
    setSaveMessage("Build a trip before remixing it.");
    return;
  }
if (remixCount >= MAX_REMIXES) {
  setSaveMessage(
    "You’ve used all 3 remixes for this trip. Start a new trip to remix again."
  );
  return;
}
 const remixInstructions: Record<string, string> = {
  cheaper:
    "Make this trip less expensive while keeping the best parts. Reduce unnecessary fuel, food, parking, admission, and activity costs. Favor free or low-cost alternatives.",

  romantic:
    "Remix this into a romantic adventure for a couple. Favor scenic stops, memorable meals, sunsets, intimate experiences, beautiful viewpoints, and relaxed pacing.",

  hiddenGems:
    "Remix this trip around hidden gems, unusual attractions, lesser-known viewpoints, quirky roadside stops, locally loved places, and experiences most tourists might miss.",

  adventure:
    "Make this trip more adventurous and exploratory. Add outdoor activities, interesting drives, unusual stops, hiking opportunities, and memorable experiences while staying realistic for the trip's time and budget.",

  rainyDay:
    "Remix this trip for rainy weather. Favor covered or indoor attractions, museums, scenic drives, interesting restaurants, indoor entertainment, and activities that still make the trip worthwhile in bad weather.",

  familyFriendly:
    "Remix this trip to be family friendly. Favor safe, fun, affordable activities suitable for families, reasonable driving times, accessible stops, food options, parks, attractions, and amusement parks when appropriate.",

  petFriendly:
    "Remix this trip to be pet friendly. Favor pet-friendly parks, trails, outdoor dining, lodging and attractions where appropriate. Avoid stops that generally prohibit pets and mention any likely leash or access restrictions.",

  adrenalineJunkie:
    "Remix this trip for an adrenaline seeker. Look for exciting experiences such as rafting, ziplining, climbing, mountain biking, off-road adventures, intense hikes, amusement rides, water sports, or other high-energy activities appropriate to the destination.",

  nightlife:
    "Remix this trip to include nightlife. Favor lively entertainment districts, live music, evening attractions, late-night food, comedy, dancing, bars or lounges when appropriate, and safe realistic evening transportation.",

  theArts:
    "Remix this trip around arts and culture. Favor museums, art galleries, live theater, architecture, public art, cultural districts, local music, artist communities, historic venues, and art festivals when available.",
};

 const instruction =
  remixTypes
    .map((type) => remixInstructions[type])
    .filter(Boolean)
    .join("\n\n") || "Create a fresh variation of this trip.";

 try {
  setIsRemixing(remixTypes.join(","));
  setSaveMessage("");
  setError("");
    const remixRequest = `
Starting Location: ${start || "Current location"}
Budget: ${budget}
Time Available: ${time}
Travelers: ${travelers}

Trip Request:
Remix my existing TrippinDays adventure.

Current Destination:
${destination}

REMIX STYLE:
${instruction}

IMPORTANT REMIX RULES:
You MUST noticeably change this itinerary based on every selected remix style.
Do not simply repeat the current itinerary.
Replace or modify several stops, activities, meals, timing, or routing when appropriate.
The new itinerary must clearly feel different while still respecting the original starting location, budget, travelers, and available time.

CURRENT ITINERARY:
${aiPlan}

Important:
Keep the trip realistic for the stated starting location, budget, travelers,
and available time.

Return a complete replacement itinerary with realistic driving times,
distances, costs, food, activities, parking, weather considerations,
return time, and RoadTunes music suggestions.
    `.trim();

    const response = await fetch("/api/plan", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tripRequest: remixRequest,
      }),
    });

    const data = await response.json();
console.log("BUDGET BREAKDOWN:", data.budgetBreakdown);
    if (!response.ok) {
      throw new Error(data.error || "Could not remix your trip.");
    }

    setAiPlan(data.plan || aiPlan);
    setDetourStops(
      Array.isArray(data.detourStops) && data.detourStops.length > 0
        ? data.detourStops.slice(0, 5)
        : parseDetourStops(data.plan || aiPlan)
    );
    setTripTitle(data.title || tripTitle);
    setDestination(data.destination || destination);
    setSummary(data.summary || summary);
setBudgetBreakdown(
  data.budgetBreakdown
    ? {
        ...data.budgetBreakdown,
        transportation:
          typeof data.budgetBreakdown.transportation === "number"
            ? data.budgetBreakdown.transportation
            : 0,
      }
    : budgetBreakdown
);
    setRoundTripMiles(
      typeof data.roundTripMiles === "number"
        ? data.roundTripMiles
        : roundTripMiles
    );

    setWhySelected(
      Array.isArray(data.whySelected)
        ? data.whySelected
        : whySelected
    );

    setAdventures(
      Array.isArray(data.adventures)
        ? data.adventures
        : adventures
    );

    setMusicSuggestions(
      Array.isArray(data.musicSuggestions)
        ? data.musicSuggestions
        : musicSuggestions
    );

    setLiveChecks(data.liveChecks || liveChecks);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
setRemixCount((current) => current + 1);
setSelectedRemixes([]);
setSaveMessage("✨ Your trip has been remixed! Choose options to remix again.");
  } catch (err) {

    setSaveMessage(
      err instanceof Error
        ? err.message
        : "Could not remix your trip."
    );
  } finally {
    setIsRemixing("");
  }
}
  async function shareTrip() {
    try {
      const text = [tripTitle, destination, summary].filter(Boolean).join("\n\n");

      if (navigator.share) {
        await navigator.share({
          title: tripTitle,
          text,
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(`${text}\n\n${window.location.href}`);
        setSaveMessage("Trip details copied to your clipboard.");
      }
    } catch {
      setSaveMessage("Sharing was cancelled.");
    }
    
  }
  
  function navigate(query = destination) {
    if (!query.trim()) {
      setSaveMessage("No destination is available for navigation.");
      return;
    }

    const params = new URLSearchParams({
      api: "1",
      destination: query,
      travelmode: "driving",
      dir_action: "navigate",
    });

    // Leave origin blank so Google Maps uses the traveler's CURRENT location.
    // This makes every TrippinDays itinerary and lodging navigation button
    // guide the traveler from wherever they are at that moment.
    window.location.href = `https://www.google.com/maps/dir/?${params.toString()}`;
  }
function openFoodNearby() {
  const destination = liveChecks?.location || "";

  const query = `restaurants near ${destination}`;

  const url =
    "https://www.google.com/maps/search/?" +
    new URLSearchParams({
      api: "1",
      query,
    }).toString();

  window.open(url, "_blank", "noopener,noreferrer");
}

function openGasNearby() {
  const destination = liveChecks?.location || "";

  const query = `gas stations near ${destination}`;

  const url =
    "https://www.google.com/maps/search/?" +
    new URLSearchParams({
      api: "1",
      query,
    }).toString();

  window.open(url, "_blank", "noopener,noreferrer");
}

function openWorshipNearby() {
  const destination = liveChecks?.location || "";

  const query = `places of worship near ${destination}`;

  const url =
    "https://www.google.com/maps/search/?" +
    new URLSearchParams({
      api: "1",
      query,
    }).toString();

  window.open(url, "_blank", "noopener,noreferrer");
}
function openMedicalNearby() {
  const destination = liveChecks?.location || "";

  const query = `hospitals and urgent care near ${destination}`;

  const url =
    "https://www.google.com/maps/search/?" +
    new URLSearchParams({
      api: "1",
      query,
    }).toString();

  window.open(url, "_blank", "noopener,noreferrer");
}
function openRoadConditions() {
  const destination = liveChecks?.location || "";

  const query = `current road conditions closures traffic near ${destination}`;

  const url =
    "https://www.google.com/search?" +
    new URLSearchParams({
      q: query,
    }).toString();

  window.open(url, "_blank", "noopener,noreferrer");
}

useEffect(() => {
  if (!aiPlan || isLoading || error) return;

  setShowSectionSkip(true);
  setShowSectionBack(true);
  const timer = window.setTimeout(() => {
    setShowSectionSkip(false);
    setShowSectionBack(false);
  }, 4500);

  return () => window.clearTimeout(timer);
}, [aiPlan, isLoading, error]);

function scrollToNextSection() {
  const sections = Array.from(
    document.querySelectorAll<HTMLElement>("[data-trip-section]")
  );

  const nextSection = sections.find(
    (section) => section.getBoundingClientRect().top > 140
  );

  if (nextSection) {
    nextSection.scrollIntoView({ behavior: "smooth", block: "start" });
    setShowSectionSkip(false);
    return;
  }

  window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  setShowSectionSkip(false);
}

function scrollToPreviousSection() {
  const sections = Array.from(
    document.querySelectorAll<HTMLElement>("[data-trip-section]")
  );

  const previousSection = [...sections]
    .reverse()
    .find((section) => section.getBoundingClientRect().top < -40);

  if (previousSection) {
    previousSection.scrollIntoView({ behavior: "smooth", block: "start" });
    setShowSectionBack(false);
    return;
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
  setShowSectionBack(false);
}

  return (
  <main
    className={`min-h-screen w-full max-w-full overflow-x-hidden text-white ${
      isLoading ? "bg-cover bg-center bg-fixed bg-no-repeat" : "bg-[#061426]"
    }`}
    style={
      isLoading
        ? {
            backgroundImage:
              "linear-gradient(rgba(3,12,24,0.28), rgba(3,12,24,0.58)), url('/images/rainbowfalls.png')",
          }
        : undefined
    }
  >
      <button
        type="button"
        onClick={() => window.history.back()}
        aria-label="Go back"
        title="Go back"
        className="fixed left-3 top-1/2 z-[100] flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-slate-950/30 text-2xl font-black text-white/50 shadow-lg backdrop-blur-sm transition hover:bg-slate-950/85 hover:text-white active:scale-95"
      >
        ←
      </button>

      {!isLoading && !error && aiPlan && (
        <div
          className="group fixed bottom-6 left-1/2 z-[100] flex -translate-x-1/2 gap-2 px-8 py-3"
          aria-label="Trip section navigation"
        >
          <button
            type="button"
            onClick={scrollToPreviousSection}
            aria-label="Go to previous section"
            title="Previous section"
            className={`flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-slate-950/55 text-2xl font-black text-white shadow-lg backdrop-blur-sm transition duration-300 hover:scale-110 hover:bg-slate-950/90 active:scale-95 group-hover:opacity-100 ${
              showSectionBack ? "opacity-100" : "opacity-0"
            }`}
          >
            ↑
          </button>
          <button
            type="button"
            onClick={scrollToNextSection}
            aria-label="Go to next section"
            title="Next section"
            className={`flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-slate-950/55 text-2xl font-black text-white shadow-lg backdrop-blur-sm transition duration-300 hover:scale-110 hover:bg-slate-950/90 active:scale-95 group-hover:opacity-100 ${
              showSectionSkip ? "opacity-100" : "opacity-0"
            }`}
          >
            ↓
          </button>
        </div>
      )}
      <header className="border-b border-white/10 bg-[#061426]/90 px-6 py-5 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <a href="/" className="text-2xl font-black">
            Trippin<span className="text-sky-400">Days</span>
          </a>
          <a href="/" className="rounded-full border border-white/20 px-5 py-2 font-bold hover:bg-white/10">
            New Adventure
          </a>
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl min-w-0 px-4 sm:px-6 py-10">
        {isLoading && <LoadingPanel />}

        {error && !isLoading && (
          <section className="rounded-3xl border border-red-400/30 bg-red-500/10 p-8">
            <h1 className="text-3xl font-black">We couldn&apos;t build that trip</h1>
            <p className="mt-3 text-red-100/80">{error}</p>
            <a href="/" className="mt-6 inline-block rounded-2xl bg-sky-500 px-6 py-4 font-black">
              Return Home
            </a>
          </section>
        )}

        {!isLoading && !error && aiPlan && (
          <>
  
            <section data-trip-section id="trip-overview" className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-blue-700 via-sky-700 to-slate-950 p-8 shadow-2xl">
              <p className="text-sm font-black uppercase tracking-[0.25em] text-sky-200">
                Your itinerary is ready
              </p>
              <h1 className="mt-4 text-4xl font-black sm:text-6xl">{tripTitle}</h1>
              <p className="mt-4 text-2xl font-bold text-sky-100">📍 {destination}</p>
              {imageUrl && (
  <div className="mt-6 overflow-hidden rounded-3xl">
    <img
      src={imageUrl}
      alt={destination || tripTitle}
      className="h-72 w-full object-cover sm:h-96"
    />

    {photographer && (
      <p className="px-3 py-2 text-xs text-white/60">
        Photo by{" "}
        <a
          href={photographerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          {photographer}
        </a>
        {" "}on{" "}
        <a
          href={pexelsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          Pexels
        </a>
      </p>
    )}
  </div>
  
)}

              {summary && <p className="mt-5 max-w-3xl text-lg leading-8 text-white/80">{summary}</p>}
              <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <button onClick={() => navigate()} className="rounded-2xl bg-white px-6 py-4 font-black text-slate-950">
                  🧭 Start Navigation
                </button>
  <button
  type="button"
  onClick={() => void saveTrip()}
  disabled={isSaving}
  className="rounded-2xl bg-emerald-500 px-6 py-4 font-black hover:bg-emerald-400 disabled:opacity-50"
>
  {saveMessage === "✅ Trip Saved!"
  ? "✅ Trip Saved!"
  : isSaving
    ? "Saving..."
    : "💾 Save Trip"}
</button>
<button
  type="button"
  onClick={() => void buildTrip(request, recentDestinations)}
  disabled={isLoading}
  className="rounded-2xl bg-violet-500 px-6 py-4 font-black hover:bg-violet-400 disabled:opacity-50"
>
  {isLoading ? "Regenerating..." : "🔄 Regenerate"}
</button>
{destination && (
  <a
    href={`https://www.google.com/search?q=${encodeURIComponent(
      destination + " official tourism visitor information attractions"
    )}`}
    target="_blank"
    rel="noopener noreferrer"
   className="flex h-full min-h-[56px] w-full items-center justify-center rounded-2xl bg-sky-500 px-6 py-4 text-center font-black text-white hover:bg-sky-400"
  >
    🔎 Research {destination}
  </a>
)}
              </div>
            </section>

            <section data-trip-section id="trip-details" className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-5">
              <SummaryCard icon="🏁" label="Starting Point" value={start || "Current location"} />
              <SummaryCard icon="💵" label="Budget" value={budget} />
              <SummaryCard icon="⏱️" label="Time Available" value={time} />
              <SummaryCard icon="👥" label="Travelers" value={travelers} />
              <SummaryCard
  icon="🚗"
  label="Round Trip"
  value={roundTripMiles !== null ? `${Math.round(roundTripMiles)} mi` : "—"}
/>
        
 <section className="text-center mt-8 col-span-2 lg:col-span-5 rounded-3xl ...">
  <div className="flex flex-col gap-4">
    <div>
      <p className="text-sm font-black uppercase tracking-widest text-amber-300">
        ⭐ Premium Adventure Builder
      </p>

      <h2 className="mt-2 text-2xl font-black">
        Remix My Trip
      </h2>

      <p className="mt-2 text-white/70">
        Change the style of your adventure without starting over.
        Choose one or more.
      </p>
    </div>

    <div
  className={`mx-auto grid w-full max-w-5xl grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 ${
    !isPremium ? "pointer-events-none opacity-40" : ""
  }`}
>

      <button
        type="button"
        onClick={() => toggleRemix("cheaper")}
        className={`min-h-[60px] w-full rounded-2xl border p-3 text-center font-bold ${
          selectedRemixes.includes("cheaper")
            ? "border-amber-300 bg-amber-400/20"
            : "border-white/10 bg-white/5 hover:bg-white/10"
        }`}
      >
        💰 Make It Cheaper
      </button>

      <button
        type="button"
        onClick={() => toggleRemix("romantic")}
        className={`min-h-[60px] w-full rounded-2xl border p-3 text-center font-bold ${
          selectedRemixes.includes("romantic")
            ? "border-amber-300 bg-amber-400/20"
            : "border-white/10 bg-white/5 hover:bg-white/10"
        }`}
      >
        💕 Romantic
      </button>

      <button
        type="button"
        onClick={() => toggleRemix("hiddenGems")}
        className={`min-h-[60px] w-full rounded-2xl border p-3 text-center font-bold ${
          selectedRemixes.includes("hiddenGems")
            ? "border-amber-300 bg-amber-400/20"
            : "border-white/10 bg-white/5 hover:bg-white/10"
        }`}
      >
        💎 Hidden Gems
      </button>

      <button
        type="button"
        onClick={() => toggleRemix("adventure")}
        className={`min-h-[60px] w-full rounded-2xl border p-3 text-center font-bold ${
          selectedRemixes.includes("adventure")
            ? "border-amber-300 bg-amber-400/20"
            : "border-white/10 bg-white/5 hover:bg-white/10"
        }`}
      >
        🧭 More Adventure
      </button>

      <button
        type="button"
        onClick={() => toggleRemix("rainyDay")}
        className={`min-h-[60px] w-full rounded-2xl border p-3 text-center font-bold ${
          selectedRemixes.includes("rainyDay")
            ? "border-amber-300 bg-amber-400/20"
            : "border-white/10 bg-white/5 hover:bg-white/10"
        }`}
      >
        🌧️ Rainy Day
      </button>

      <button
        type="button"
        onClick={() => toggleRemix("familyFriendly")}
        className={`min-h-[60px] w-full rounded-2xl border p-3 text-center font-bold ${
          selectedRemixes.includes("familyFriendly")
            ? "border-amber-300 bg-amber-400/20"
            : "border-white/10 bg-white/5 hover:bg-white/10"
        }`}
      >
        👨‍👩‍👧 Family Friendly
      </button>

      <button
        type="button"
        onClick={() => toggleRemix("petFriendly")}
        className={`min-h-[60px] w-full rounded-2xl border p-3 text-center font-bold ${
          selectedRemixes.includes("petFriendly")
            ? "border-amber-300 bg-amber-400/20"
            : "border-white/10 bg-white/5 hover:bg-white/10"
        }`}
      >
        🐾 Pet Friendly
      </button>

      <button
        type="button"
        onClick={() => toggleRemix("adrenalineJunkie")}
        className={`min-h-[60px] w-full rounded-2xl border p-3 text-center font-bold ${
          selectedRemixes.includes("adrenalineJunkie")
            ? "border-amber-300 bg-amber-400/20"
            : "border-white/10 bg-white/5 hover:bg-white/10"
        }`}
      >
        ⚡ Adrenaline Junkie
      </button>

      <button
        type="button"
        onClick={() => toggleRemix("nightlife")}
        className={`min-h-[60px] w-full rounded-2xl border p-3 text-center font-bold ${
          selectedRemixes.includes("nightlife")
            ? "border-amber-300 bg-amber-400/20"
            : "border-white/10 bg-white/5 hover:bg-white/10"
        }`}
      >
        🌙 Nightlife
      </button>

      <button
        type="button"
        onClick={() => toggleRemix("theArts")}
        className={`min-h-[60px] w-full rounded-2xl border p-3 text-center font-bold ${
          selectedRemixes.includes("theArts")
            ? "border-amber-300 bg-amber-400/20"
            : "border-white/10 bg-white/5 hover:bg-white/10"
        }`}
      >
        🎨 The Arts
      </button>

    </div>

    <button
      type="button"
      onClick={() => void remixTrip(selectedRemixes)}
      disabled={!isPremium || selectedRemixes.length === 0 || Boolean(isRemixing)}
      className="mx-auto mt-2 w-full max-w-5xl rounded-2xl bg-amber-400 px-6 py-4 font-black text-slate-950 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {isRemixing ? "✨ Remixing Trip..." : "✨ Remix Selected Options"}
    </button>
    {!isPremium && (
  <div className="mt-3 text-center">
    <p className="font-bold text-amber-200">
      🔒 Remix My Trip is a Premium feature
    </p>

   <button
  type="button"
  onClick={async () => {
    const response = await fetch("/api/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        plan: "yearly",
      }),
    });

    const data = await response.json();

    if (data.url) {
      window.location.href = data.url;
    }
  }}
  className="mt-2 inline-block rounded-xl bg-amber-400 px-5 py-3 font-black text-slate-950 hover:bg-amber-300"
>
  ⭐ Upgrade to Premium
</button>
  </div>
)}
  </div>
    </section>
        
  </section>

            <section className="mt-8 grid gap-6 lg:grid-cols-2">
               {budgetBreakdown && budgetBreakdown.total > 0 && (
  <div className="w-full min-w-0 rounded-3xl border border-white/10 bg-white/5 p-6">

    {/* TITLE CENTERED AT TOP */}
    <h2 className="mb-6 text-center text-xl font-black uppercase tracking-wide text-white">
      Budget Breakdown
    </h2>

    {/* DONUT LEFT / COST BREAKDOWN RIGHT */}
    <div className="grid w-full grid-cols-[42%_58%] items-center gap-2">

      {/* LEFT SIDE — DONUT GRAPH */}
      <div className="flex justify-center">
        <div
          className="relative h-40 w-40 shrink-0 rounded-full"
          style={{
            background: `conic-gradient(
              #22c55e 0deg ${(budgetBreakdown.fuel / budgetBreakdown.total) * 360}deg,
              #38bdf8 ${(budgetBreakdown.fuel / budgetBreakdown.total) * 360}deg ${((budgetBreakdown.fuel + budgetBreakdown.food) / budgetBreakdown.total) * 360}deg,
              #a855f7 ${((budgetBreakdown.fuel + budgetBreakdown.food) / budgetBreakdown.total) * 360}deg ${((budgetBreakdown.fuel + budgetBreakdown.food + budgetBreakdown.activities) / budgetBreakdown.total) * 360}deg,
              #f59e0b ${((budgetBreakdown.fuel + budgetBreakdown.food + budgetBreakdown.activities) / budgetBreakdown.total) * 360}deg ${((budgetBreakdown.fuel + budgetBreakdown.food + budgetBreakdown.activities + budgetBreakdown.parking) / budgetBreakdown.total) * 360}deg,
              #ec4899 ${((budgetBreakdown.fuel + budgetBreakdown.food + budgetBreakdown.activities + budgetBreakdown.parking) / budgetBreakdown.total) * 360}deg ${((budgetBreakdown.fuel + budgetBreakdown.food + budgetBreakdown.activities + budgetBreakdown.parking + budgetBreakdown.lodging) / budgetBreakdown.total) * 360}deg,
              #14b8a6 ${((budgetBreakdown.fuel + budgetBreakdown.food + budgetBreakdown.activities + budgetBreakdown.parking + budgetBreakdown.lodging) / budgetBreakdown.total) * 360}deg ${((budgetBreakdown.fuel + budgetBreakdown.food + budgetBreakdown.activities + budgetBreakdown.parking + budgetBreakdown.lodging + budgetBreakdown.transportation) / budgetBreakdown.total) * 360}deg,
              #e2e8f0 ${((budgetBreakdown.fuel + budgetBreakdown.food + budgetBreakdown.activities + budgetBreakdown.parking + budgetBreakdown.lodging + budgetBreakdown.transportation) / budgetBreakdown.total) * 360}deg 360deg
            )`,
          }}
        >
          {/* CENTER OF DONUT */}
          <div className="absolute inset-5 flex items-center justify-center rounded-full bg-slate-950">
            <div className="text-center">
              <p className="text-xs font-black uppercase text-white/60">
                Total
              </p>

              <p className="text-xl font-black text-white">
                ${budgetBreakdown.total.toFixed(0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE — COST BREAKDOWN */}
      <div className="flex min-w-0 flex-col justify-center gap-3 pl-2 text-left text-white">

        <p className="whitespace-nowrap font-bold">
          🟢 Fuel — ${budgetBreakdown.fuel.toFixed(0)}
        </p>

        <p className="whitespace-nowrap font-bold">
          🔵 Food — ${budgetBreakdown.food.toFixed(0)}
        </p>

        <p className="whitespace-nowrap font-bold">
          🟣 Activities — ${budgetBreakdown.activities.toFixed(0)}
        </p>

        <p className="whitespace-nowrap font-bold">
          🟡 Parking — ${budgetBreakdown.parking.toFixed(0)}
        </p>

        <p className="whitespace-nowrap font-bold">
          🩷 Lodging — ${budgetBreakdown.lodging.toFixed(0)}
        </p>

        <p className="whitespace-nowrap font-bold">
          🟩 Transportation — ${budgetBreakdown.transportation.toFixed(0)}
        </p>

        <p className="whitespace-nowrap font-bold">
          ⚪ Other — ${budgetBreakdown.other.toFixed(0)}
        </p>

      </div>
    </div>
  </div>
)}
              <div className="w-full min-w-0 rounded-3xl border border-cyan-400/20 bg-cyan-500/5 p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black uppercase tracking-wide text-cyan-300">
                      💳 Trip Spending
                    </p>
                    <h2 className="mt-2 text-2xl font-black">
                      {actualTripExpenses.length > 0
                        ? "Money Spent So Far"
                        : testTripExpenses.length > 0
                          ? "Test Spending Preview"
                          : "Nothing Spent Yet"}
                    </h2>
                    <p className="mt-2 text-sm text-white/60">
                      Confirmed bookings made through TrippinDays are added automatically.
                    </p>
                  </div>

                  {actualTripExpenses.length === 0 && testTripExpenses.length > 0 && (
                    <span className="rounded-full border border-amber-300/30 bg-amber-400/10 px-3 py-1 text-xs font-black uppercase tracking-widest text-amber-200">
                      Test Mode
                    </span>
                  )}
                </div>

                {displayTripExpenses.length > 0 ? (
                  <>
                    <div className="mt-6 grid items-center gap-6 sm:grid-cols-[190px_1fr]">
                      <div className="flex justify-center">
                        <div
                          className="relative h-44 w-44 shrink-0 rounded-full"
                          style={{
                            background:
                              numericTripBudget > 0
                                ? `conic-gradient(#22c55e 0deg ${
                                    (Math.min(tripSpentTotal, numericTripBudget) /
                                      numericTripBudget) *
                                    360
                                  }deg, rgba(255,255,255,0.12) ${
                                    (Math.min(tripSpentTotal, numericTripBudget) /
                                      numericTripBudget) *
                                    360
                                  }deg 360deg)`
                                : "conic-gradient(#22c55e 0deg 360deg)",
                          }}
                        >
                          <div className="absolute inset-5 flex items-center justify-center rounded-full bg-slate-950">
                            <div className="text-center">
                              <p className="text-xs font-black uppercase text-white/50">
                                {actualTripExpenses.length > 0 ? "Spent" : "Test"}
                              </p>
                              <p className="text-2xl font-black text-white">
                                ${tripSpentTotal.toFixed(0)}
                              </p>
                              {remainingTripBudget !== null && (
                                <p className="mt-1 text-xs font-bold text-emerald-300">
                                  ${remainingTripBudget.toFixed(0)} left
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {Object.entries(spendingByCategory).map(([category, amount]) => (
                          <div
                            key={category}
                            className="flex items-center justify-between gap-4 rounded-xl bg-black/20 px-4 py-3"
                          >
                            <span className="font-bold">
                              {category === "Flights"
                                ? "✈️"
                                : category === "Train / Bus"
                                  ? "🚆"
                                  : category === "Lodging"
                                    ? "🏨"
                                    : category === "Rental Car"
                                      ? "🚗"
                                      : category === "Activities"
                                        ? "🎟️"
                                        : category === "Fuel"
                                          ? "⛽"
                                          : category === "Food"
                                            ? "🍽️"
                                            : category === "Parking"
                                              ? "🅿️"
                                              : "💵"}{" "}
                              {category}
                            </span>
                            <span className="font-black text-emerald-300">
                              ${amount.toFixed(2)}
                            </span>
                          </div>
                        ))}

                        {Number.isFinite(numericTripBudget) && numericTripBudget > 0 && (
                          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                            <div className="flex items-center justify-between gap-4">
                              <span className="font-bold text-white/70">Trip Budget</span>
                              <span className="font-black">${numericTripBudget.toFixed(2)}</span>
                            </div>
                            <div className="mt-2 flex items-center justify-between gap-4">
                              <span className="font-bold text-white/70">Remaining</span>
                              <span className="font-black text-cyan-300">
                                ${Math.max(numericTripBudget - tripSpentTotal, 0).toFixed(2)}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-5 space-y-2">
                      {displayTripExpenses.map((expense) => (
                        <div
                          key={expense.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/15 px-4 py-3 text-sm"
                        >
                          <div>
                            <p className="font-black">{expense.label}</p>
                            <p className="text-xs text-white/45">
                              {expense.source}
                              {expense.testMode ? " • Test booking" : " • Confirmed"}
                            </p>
                          </div>
                          <p className="font-black text-emerald-300">
                            {expense.currency} {expense.amount.toFixed(2)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="mt-6 rounded-2xl border border-dashed border-white/15 bg-black/15 p-6 text-center">
                    <p className="text-4xl">💳</p>
                    <p className="mt-3 font-black">No confirmed spending yet</p>
                    <p className="mt-2 text-sm text-white/55">
                      Your first confirmed flight, train, lodging, rental car, or ticket purchase can appear here automatically.
                    </p>
                  </div>
                )}
              </div>

              <div className="w-full min-w-0 rounded-3xl border border-emerald-400/25 bg-emerald-500/10 p-7 lg:col-span-2">
                <p className="text-sm font-black uppercase tracking-widest text-emerald-300">🏆 Why this trip fits</p>
                <h2 className="mt-3 text-3xl font-black">{destination}</h2>
                <div className="mt-5 space-y-3">
                  {(whySelected.length ? whySelected : ["Matches your request, budget, and available time."]).map((reason, index) => (
                    <p key={`${reason}-${index}`} className="rounded-2xl bg-black/20 p-4 text-white/80 mx-3">
                      ✅ {reason}
                    </p>
                  ))}
                </div>
              </div>
<div className="grid w-full min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-2">
  <button
    type="button"
    onClick={openFoodNearby}
  className="w-full min-w-0 rounded-3xl border border-white/10 bg-white/5 p-6 text-left transition hover:border-cyan-300/40"
  >
    <div className="text-3xl">🍽️</div>
    <h3 className="mt-3 text-xl font-black">Food Nearby</h3>
    <p className="mt-2 text-sm text-white/60">
      Find restaurants near your destination.
    </p>
    <p className="mt-4 text-sm font-black text-cyan-300">
      Open in Maps →
    </p>
  </button>

  <button
    type="button"
    onClick={openGasNearby}
 className="w-full min-w-0 rounded-3xl border border-white/10 bg-white/5 p-6 text-left transition hover:border-cyan-300/40"
  >
    <div className="text-3xl">⛽</div>
    <h3 className="mt-3 text-xl font-black">Gas Nearby</h3>
    <p className="mt-2 text-sm text-white/60">
      Find fuel stops near your destination.
    </p>
    <p className="mt-4 text-sm font-black text-cyan-300">
      Open in Maps →
    </p>
  </button>

  <button
    type="button"
    onClick={openWorshipNearby}
  className="w-full min-w-0 rounded-3xl border border-white/10 bg-white/5 p-6 text-left transition hover:border-cyan-300/40">
    <div className="text-3xl">🙏</div>
    <h3 className="mt-3 text-xl font-black">Places of Worship</h3>
    <p className="mt-2 text-sm text-white/60">
      Find churches, temples, mosques, synagogues, and other places of worship nearby.
    </p>
    <p className="mt-4 text-sm font-black text-cyan-300">
      Explore Nearby →
    </p>
  </button>

  <button
    type="button"
    onClick={openMedicalNearby}
  className="w-full min-w-0 rounded-3xl border border-white/10 bg-white/5 p-6 text-left transition hover:border-cyan-300/40"
  >
    <div className="text-3xl">🏥</div>
    <h3 className="mt-3 text-xl font-black">
      Hospitals & Urgent Care
    </h3>
    <p className="mt-2 text-sm text-white/60">
      Find hospitals, emergency rooms, and urgent care near your destination.
    </p>
    <p className="w-[calc(100%-16px)] mx-auto min-w-0 rounded-3xl ...">
      Open in Maps →
    </p>
  </button>

<button
  type="button"
  onClick={openRoadConditions}
className="w-full min-w-0 rounded-3xl border border-white/10 bg-white/5 p-6 text-left transition hover:border-cyan-300/40"
>
  <div className="text-3xl">🚧</div>

  <h3 className="mt-3 text-xl font-black">
    Road Conditions
  </h3>

  <p className="mt-2 text-sm text-white/60">
    Check current road conditions, closures, and traffic.
  </p>

  <p className="mt-4 text-sm font-black text-cyan-300">
    Check Roads →
  </p>
</button>
{musicSuggestions.length > 0 && (
  <div className="w-full min-w-0 rounded-3xl border border-white/10 bg-white/5 p-6 text-left">
    <div className="text-3xl">🎵</div>

    <h3 className="mt-3 text-xl font-black">
      Music for the Trip
    </h3>

    <p className="mt-2 text-sm text-white/60">
      Songs picked to match your adventure.
    </p>

    <div className="mt-4 space-y-2">
      {musicSuggestions.map((song, index) => (
        <div key={index}>
          <p className="text-sm font-black">{song.title}</p>
          <p className="text-sm text-cyan-300">{song.artist}</p>
        </div>
      ))}
    </div>
  </div>
)}
</div>
  {eventsLoading && (
  <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6">
    <p className="text-center font-bold text-white/70">
      Loading nearby sports and concerts...
    </p>
  </section>
)}

{!eventsLoading && (nearbyEvents.length > 0 || detourStops.length > 0) && (
  <section className="space-y-6">

    {/* DETOUR-WORTHY STOPS — above Live Sports and Concerts */}
    {detourStops.length > 0 && (
      <div
        id="trip-detour-worthy-stops"
        className="rounded-3xl border border-white/10 bg-white/5 p-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black text-white">
              🧭 Detour-Worthy Stops
            </h2>
            <p className="mt-2 text-sm text-white/60">
              Worth getting off the highway for. Detour time and mileage are estimates.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {detourStops.slice(0, 5).map((stop, index) => (
            <div
              key={`${stop.name}-${index}`}
              className="rounded-2xl border border-white/10 bg-black/20 p-5"
            >
              <h3 className="text-lg font-black text-white">{stop.name}</h3>
              {stop.area && (
                <p className="mt-1 text-sm font-bold text-cyan-300">📍 {stop.area}</p>
              )}

              <div className="mt-3 flex flex-wrap gap-2 text-xs font-black">
                {stop.detourTime && (
                  <span className="rounded-full bg-white/10 px-3 py-1.5 text-white/80">
                    ⏱️ {stop.detourTime}
                  </span>
                )}
                {stop.detourMiles && (
                  <span className="rounded-full bg-white/10 px-3 py-1.5 text-white/80">
                    🛣️ {stop.detourMiles}
                  </span>
                )}
              </div>

              {stop.reason && (
                <p className="mt-3 text-sm leading-6 text-white/70">{stop.reason}</p>
              )}

              <button
                type="button"
                onClick={() => navigate([stop.name, stop.area].filter(Boolean).join(", "))}
                className="mt-4 rounded-xl bg-sky-500 px-4 py-2 font-black text-white transition hover:bg-sky-400"
              >
                🧭 Navigate Here
              </button>
            </div>
          ))}
        </div>
      </div>
    )}


    {/*  SPORTS */}
    {nearbyEvents.some((event) => event.type === "sports") && (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h2 className="mb-5 text-2xl font-black text-white">
          🏟️ Live Sports Nearby
        </h2>

        <div className="grid gap-4 md:grid-cols-2">
          {nearbyEvents
            .filter((event) => event.type === "sports")
            .slice(0, 6)
            .map((event) => (
              <div
                key={event.id}
                className="rounded-2xl border border-white/10 bg-black/20 p-5"
              >
                <h3 className="text-lg font-black text-white">
                  {event.name}
                </h3>

                <p className="mt-2 text-sm text-white/70">
                  {event.venue?.name}
                  {event.venue?.city ? ` • ${event.venue.city}` : ""}
                  {event.venue?.state ? `, ${event.venue.state}` : ""}
                </p>

                <p className="mt-2 text-sm font-bold text-cyan-300">
                  {event.date}
                  {event.time ? ` • ${event.time}` : ""}
                </p>

                {event.ticketUrl && (
                  <a
                    href={event.ticketUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-block rounded-xl bg-emerald-500 px-4 py-2 font-black text-black"
                  >
                    🎟️ Buy Tickets
                  </a>
                )}
              </div>
            ))}
        </div>
      </div>
    )}

    {/* CONCERTS */}
    {nearbyEvents.some((event) => event.type === "concert") && (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h2 className="mb-5 text-2xl font-black text-white">
          🎵 Concerts Nearby
        </h2>

        <div className="grid gap-4 md:grid-cols-2">
          {nearbyEvents
            .filter((event) => event.type === "concert")
            .slice(0, 6)
            .map((event) => (
              <div
                key={event.id}
                className="rounded-2xl border border-white/10 bg-black/20 p-5"
              >
                <h3 className="text-lg font-black text-white">
                  {event.name}
                </h3>

                <p className="mt-2 text-sm text-white/70">
                  {event.venue?.name}
                  {event.venue?.city ? ` • ${event.venue.city}` : ""}
                  {event.venue?.state ? `, ${event.venue.state}` : ""}
                </p>

                <p className="mt-2 text-sm font-bold text-cyan-300">
                  {event.date}
                  {event.time ? ` • ${event.time}` : ""}
                </p>

                {event.ticketUrl && (
                  <a
                    href={event.ticketUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-block rounded-xl bg-violet-500 px-4 py-2 font-black text-white"
                  >
                    🎟️ Buy Tickets
                  </a>
                )}
              </div>
            ))}
        </div>
      </div>
    )}


  </section>
)}

              <WeatherPanel
  liveChecks={liveChecks}
  overnightStops={overnightStops}
  travelers={travelers}
  origin={start}
  destination={destination}
  tripDate={startDate}
  tripPlan={aiPlan}
  onNavigate={(query) => navigate(query)}
  onRecordTripExpense={recordTripExpense}
/>
            </section>

            <section data-trip-section id="trip-itinerary-section" className="mt-10 scroll-mt-6">
              <p className="text-sm font-black uppercase tracking-widest text-sky-300">
                Your day, stop by stop
              </p>
              <h2 className="mt-2 text-4xl font-black">Itinerary</h2>

              <div className="mt-6 space-y-5">
                {sections.map((section, index) => (
                  <ItineraryCard
                    key={`${section.title}-${index}`}
                    section={section}
                    index={index}
                    onNavigate={(query) => navigate(query)}
                  />
                ))}
              </div>
            </section>

            {adventures.length > 0 && (
              <section data-trip-section id="trip-other-adventures" className="mt-10 scroll-mt-6">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="text-sm font-black uppercase tracking-widest text-sky-300">
                      Other adventures
                    </p>
                    <h2 className="mt-2 text-4xl font-black">
                      More matches for your request
                    </h2>
                  </div>

                  <div className="rounded-full bg-sky-500/15 px-5 py-2 font-bold text-sky-200">
                    {adventures.length} choices
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                  {adventures.map((adventure, index) => (
                    <AdventureCard
                      key={`${adventure.name}-${index}`}
                      adventure={adventure}
                      selected={index === 0}
                      onOpen={() => openAdventure(adventure)}
                    />
                  ))}
                </div>
              </section>
            )}

            <section data-trip-section id="trip-finish" className="mt-10 scroll-mt-6 rounded-3xl border border-white/10 bg-white/5 p-8">
              <p className="text-sm font-black uppercase tracking-widest text-sky-300">
                Finish your adventure
              </p>

              <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-7">
              <button
  type="button"
onClick={() => void saveTrip()}
  disabled={isSaving}
className="rounded-2xl bg-emerald-500 px-6 py-4 font-black flex flex-col items-center justify-center gap-2 ..."
>
{saveMessage === "🟩 Trip Saved!" ? (
  <>
    <span>🟩</span>
    <span>Trip Saved!</span>
  </>
) : isSaving ? (
  <span>Saving...</span>
) : (
  <>
    <span>💾</span>
    <span>Save Trip</span>
  </>
)}
</button>
<button
  type="button"
  onClick={() => void buildTrip(request, recentDestinations)}
  disabled={isLoading}
 className="rounded-2xl bg-violet-500 px-6 py-4 font-black flex flex-col items-center justify-center gap-2 ..."
>
  {isLoading ? (
    <span className="whitespace-nowrap">Regenerating...</span>
  ) : (
    <>
      <span>🔄</span>
      <span className="whitespace-nowrap">Regenerate</span>
    </>
  )}
</button>
                <button
                  type="button"
                  onClick={() => navigate()}
                className="rounded-2xl bg-blue-500 px-6 py-4 font-black flex flex-col items-center justify-center gap-2 ..."
                >
                  <span>🧭</span>
                  <span className="whitespace-nowrap">Start Entire Trip</span>
                </button>

                <a
  href="/journal"
  className="rounded-2xl bg-cyan-500 px-6 py-4 font-black flex flex-col items-center justify-center gap-2"
>
  <span>📓</span>
  <span className="whitespace-nowrap">Create Journal</span>
</a>

                <a
  href="/passport"
className="rounded-2xl bg-cyan-500 px-6 py-4 font-black flex flex-col items-center justify-center gap-2 ..."
>
  <span>🛂</span>
  <span className="whitespace-nowrap">View Passport</span>
</a>

               <button
  type="button"
  onClick={() => window.print()}
  className="rounded-2xl bg-slate-500 px-6 py-4 font-black flex flex-col items-center justify-center gap-2 ..."
>
  <span>🖨️</span>
  <span className="whitespace-nowrap">Print</span>
</button>

                <button
  type="button"
  onClick={() => void shareTrip()}
 className="rounded-2xl bg-sky-500 px-6 py-4 font-black flex flex-col items-center justify-center gap-2 ..."
>
  <span>📤</span>
  <span className="whitespace-nowrap">Share</span>
</button>
              </div>

             {saveMessage && (
  <div className="mx-auto mt-5 max-w-3xl rounded-2xl bg-amber-500/15 p-4 text-center font-bold text-amber-200 break-words">
    {saveMessage}
  </div>
)}
            </section>

            <section
              aria-label="Travel information disclaimer"
              className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm leading-6 text-white/55"
            >
              <span className="font-bold text-white/70">Travel Information Disclaimer:</span>{" "}
              TrippinDays provides AI-generated travel suggestions and estimated costs,
              distances, drive times, and other trip information for planning purposes
              only. Prices, availability, weather, road conditions, hours, fees, and
              travel requirements can change. Always verify important information with
              the appropriate provider or official source before traveling.
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <div className="text-3xl">{icon}</div>
      <p className="mt-4 text-xs font-black uppercase tracking-widest text-white/40">
        {label}
      </p>
      <p className="mt-2 text-lg font-black">{value}</p>
    </div>
  );
}

function ItineraryCard({
  section,
  index,
  onNavigate,
}: {
  section: Section;
  index: number;
  onNavigate: (query: string) => void;
}) {
  return (
    <article
  id={index === 0 ? "adventure-itinerary" : undefined}
  className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl"
>
      <div className="flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-sky-400/15 text-3xl">
          {section.emoji}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-sky-300">
            Stop {index + 1}
          </p>
          <h3 className="mt-2 text-2xl font-black">
  {section.title}
  {!/(check before leaving|warning|weather|budget|cost|drive|distance|travel|depart|arrive)/i.test(section.title) && (
  <a
    href={`https://www.google.com/search?q=${encodeURIComponent(
      section.title + " official website visitor information"
    )}`}
    target="_blank"
    rel="noopener noreferrer"
    className="ml-3 text-sm font-bold text-sky-300 underline hover:text-sky-200"
  >
    🔎 Research
  </a>
)}
</h3>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {section.lines.map((line, lineIndex) => (
          <p
            key={`${line}-${lineIndex}`}
            className="rounded-2xl bg-black/20 p-4 leading-7 text-white/80"
          >
            {line}
          </p>
        ))}
      </div>

      {section.navigationQuery && (
        <button
          type="button"
          onClick={() => onNavigate(section.navigationQuery!)}
          className="mt-5 w-full rounded-2xl bg-blue-600 px-5 py-4 font-black hover:bg-blue-500"
        >
          🧭 Navigate Here
        </button>
      )}
    </article>
  );
}

function AdventureCard({
  adventure,
  selected,
  onOpen,
}: {
  adventure: AdventureOption;
  selected: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`relative w-full rounded-3xl border p-6 text-left transition hover:-translate-y-1 hover:shadow-2xl ${
        selected
          ? "border-emerald-400/50 bg-emerald-500/10"
          : "border-white/10 bg-white/5"
      }`}
    >
      {selected && (
        <div className="absolute right-4 top-4 rounded-full bg-emerald-400 px-3 py-1 text-xs font-black text-slate-950">
          AI PICK
        </div>
      )}

      <div className="text-5xl">{adventure.emoji || "🚗"}</div>
      <h3 className="mt-4 pr-16 text-2xl font-black">{adventure.name}</h3>
      <p className="mt-1 text-white/55">{adventure.region}</p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <InfoCard label="Match" value={`${adventure.matchScore}/100`} />
        <InfoCard label="Cost" value={`$${adventure.estimatedCost}`} />
        <InfoCard label="Drive" value={adventure.estimatedDriveTime} />
        <InfoCard label="Distance" value={adventure.estimatedDistance} />
      </div>

      <p className="mt-5 leading-7 text-white/70">{adventure.reason}</p>
      <div className="mt-6 font-black text-sky-300">Build This Trip →</div>
    </button>
  );
}

function WeatherPanel({
  liveChecks,
  overnightStops,
  travelers,
  origin,
  destination,
  tripDate,
  tripPlan,
  onNavigate,
  onRecordTripExpense,
}: {
  liveChecks: LiveChecks | null;
  overnightStops: OvernightStop[];
  travelers: string;
  origin: string;
  destination: string;
  tripDate: string;
  tripPlan: string;
  onNavigate: (query: string) => void;
  onRecordTripExpense: (expense: TripExpense) => void;
}) {
  const [bookingChoice, setBookingChoice] = useState<{
    stop: OvernightStop;
    kind: "Hotels & Motels" | "Campgrounds & RV" | "Cabins & Lodges";
  } | null>(null);

  const [flightOpen, setFlightOpen] = useState(false);
  const [trainBusOpen, setTrainBusOpen] = useState(false);
  const [flightOrigin, setFlightOrigin] = useState(origin);
  const [flightDestination, setFlightDestination] = useState(destination);
  const [flightDepartureDate, setFlightDepartureDate] = useState(tripDate);
  const [flightReturnDate, setFlightReturnDate] = useState("");
  const [flightOffers, setFlightOffers] = useState<FlightOffer[]>([]);
  const [selectedOutboundKey, setSelectedOutboundKey] = useState("");
  const [flightLoading, setFlightLoading] = useState(false);
  const [flightError, setFlightError] = useState("");
  const [resolvedFlightRoute, setResolvedFlightRoute] = useState("");
  const [airportResolving, setAirportResolving] = useState(false);
  const [selectedFlight, setSelectedFlight] = useState<FlightOffer | null>(null);
  const [checkoutOffer, setCheckoutOffer] = useState<FlightCheckoutOffer | null>(null);
  const [passengerForms, setPassengerForms] = useState<FlightPassengerForm[]>([]);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [componentClientKey, setComponentClientKey] = useState("");
  const {
  ref: cardFormRef,
  createCardForTemporaryUse,
} = useDuffelCardFormActions();
const [cardReady, setCardReady] = useState(false);
const [temporaryCardId, setTemporaryCardId] = useState("");
const [threeDSecureSessionId, setThreeDSecureSessionId] = useState("");
  const [orderConfirmation, setOrderConfirmation] =
    useState<FlightOrderConfirmation | null>(null);
  const [orderLoading, setOrderLoading] = useState(false);

  // Omio's widget currently displays YYYY-MM-DD one calendar day early in
  // Pacific-time browsers. Keep TrippinDays' actual dates unchanged and only
  // compensate in the values handed to the embedded Omio widget.
  const omioDepartureDate = tripDate ? addCalendarDays(tripDate, 1) : "";
  const omioReturnDate = flightReturnDate
    ? addCalendarDays(flightReturnDate, 1)
    : "";

  useEffect(() => {
    // Load the official Omio affiliate widget only when the traveler opens
    // Trains & Buses. This makes sure the trip dates below are already set
    // before Omio initializes the widget.
    if (!trainBusOpen) return;

    const styleId = "trippindays-omio-widget-style";
    const scriptId = "trippindays-omio-widget-script";
    const cacheBust = Date.now();

    if (!document.getElementById(styleId)) {
      const widgetStyle = document.createElement("link");
      widgetStyle.id = styleId;
      widgetStyle.rel = "stylesheet";
      widgetStyle.href =
        `https://www.omio.com/gcs-proxy/b2b-nemo-prod/bundle/en/bundle.css?v=${cacheBust}`;
      document.head.appendChild(widgetStyle);
    }

    // The Omio bundle initializes widgets that are already in the DOM.
    // Remove an older bundle instance before loading a fresh one so a
    // reopened modal can initialize the current widget cleanly.
    document.getElementById(scriptId)?.remove();

    const widgetScript = document.createElement("script");
    widgetScript.id = scriptId;
    widgetScript.src =
      `https://www.omio.com/gcs-proxy/b2b-nemo-prod/bundle/en/bundle.js?v=${cacheBust}`;
    widgetScript.async = true;
    document.body.appendChild(widgetScript);
  }, [trainBusOpen, omioDepartureDate, omioReturnDate]);

  useEffect(() => {
    setFlightOrigin(origin);
  }, [origin]);

  useEffect(() => {
    setFlightDestination(destination);
  }, [destination]);

  useEffect(() => {
    if (tripDate) {
      setFlightDepartureDate(tripDate);
    }
  }, [tripDate]);

  useEffect(() => {
    // Prefer the checkout date from the final overnight stop. If the itinerary
    // did not use the exact "Tonight in ..." phrasing needed by the lodging
    // parser, fall back to the highest "Day N" heading in the itinerary.
    // This lets round-trip transportation still get a sensible return date.
    if (overnightStops.length > 0) {
      const lastStop = overnightStops[overnightStops.length - 1];

      if (lastStop?.checkOut) {
        setFlightReturnDate(lastStop.checkOut);
        return;
      }
    }

    if (tripDate && tripPlan) {
      const dayNumbers = Array.from(tripPlan.matchAll(/(?:^|\n)\s*(?:#{1,6}\s*)?(?:\*\*)?day\s*(\d+)\b/gim))
        .map((match) => Number(match[1]))
        .filter((value) => Number.isFinite(value) && value > 0);

      const lastDay = dayNumbers.length > 0 ? Math.max(...dayNumbers) : 0;

      if (lastDay > 1) {
        setFlightReturnDate(addCalendarDays(tripDate, lastDay - 1));
        return;
      }
    }

    setFlightReturnDate("");
  }, [overnightStops, tripDate, tripPlan]);

  async function resolveAirports() {
    if (!origin.trim() || !destination.trim()) return;

    try {
      setAirportResolving(true);
      setFlightError("");
      setResolvedFlightRoute("");

      const response = await fetch("/api/airports/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: origin.trim(),
          destination: destination.trim(),
          destinationLatitude: liveChecks?.latitude ?? null,
          destinationLongitude: liveChecks?.longitude ?? null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Could not find nearby airports.");
      }

      if (data?.origin?.iataCode) setFlightOrigin(data.origin.iataCode);
      if (data?.destination?.iataCode) setFlightDestination(data.destination.iataCode);

      if (data?.origin && data?.destination) {
        setResolvedFlightRoute(
          `${data.origin.name} (${data.origin.iataCode}) → ${data.destination.name} (${data.destination.iataCode})`
        );
      }
    } catch (error) {
      setFlightError(
        error instanceof Error ? error.message : "Could not find nearby airports."
      );
    } finally {
      setAirportResolving(false);
    }
  }

  useEffect(() => {
    if (!flightOpen) return;
    void resolveAirports();
  }, [flightOpen, origin, destination, liveChecks?.latitude, liveChecks?.longitude]);

  async function searchFlights() {
    if (!flightOrigin.trim() || !flightDestination.trim() || !flightDepartureDate) {
      setFlightError("Starting location, destination, and departure date are required.");
      return;
    }

    try {
      setFlightLoading(true);
      setFlightError("");
      setFlightOffers([]);
      setSelectedOutboundKey("");
      setResolvedFlightRoute("");

      const response = await fetch("/api/flights", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          origin: flightOrigin.trim(),
          destination: flightDestination.trim(),
          departureDate: flightDepartureDate,
          returnDate: flightReturnDate || undefined,
          adults: getAdultCount(travelers),
          cabinClass: "economy",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Could not search flights.");
      }

      const offers = Array.isArray(data?.offers) ? data.offers : [];
      setFlightOffers(offers);

      if (data?.resolvedOrigin && data?.resolvedDestination) {
        setResolvedFlightRoute(
          `${data.resolvedOrigin.name} (${data.resolvedOrigin.iataCode}) → ${data.resolvedDestination.name} (${data.resolvedDestination.iataCode})`
        );
      }

      if (offers.length === 0) {
        setFlightError(
          "No flights were found for that route. Try a nearby major airport or city."
        );
      }
    } catch (error) {
      setFlightError(
        error instanceof Error ? error.message : "Could not search flights."
      );
    } finally {
      setFlightLoading(false);
    }
  }

  function outboundKey(offer: FlightOffer) {
    return [
      offer.airline,
      offer.origin,
      offer.destination,
      offer.departureTime || "",
      offer.arrivalTime || "",
      offer.duration || "",
      String(offer.stops),
      ...(offer.operatingCarriers || []),
    ].join("|");
  }

  const uniqueOutboundOffers = flightOffers.filter(
    (offer, index, allOffers) =>
      allOffers.findIndex((candidate) => outboundKey(candidate) === outboundKey(offer)) === index
  );

  const selectedOutboundOffers = selectedOutboundKey
    ? flightOffers.filter((offer) => outboundKey(offer) === selectedOutboundKey)
    : [];

  const selectedOutbound =
    selectedOutboundOffers.length > 0 ? selectedOutboundOffers[0] : null;

  async function prepareFlightCheckout(offer: FlightOffer) {
    try {
      setCheckoutLoading(true);
      setCheckoutError("");
      setComponentClientKey("");
      setCardReady(false);
setTemporaryCardId("");
setThreeDSecureSessionId("");
      setOrderConfirmation(null);
const keyResponse = await fetch("/api/flights/client-key", {
  method: "POST",
});

const keyData = await keyResponse.json();

if (!keyResponse.ok || !keyData?.clientKey) {
  throw new Error(
    keyData?.error || "Could not prepare secure flight payment."
  );
}

setComponentClientKey(keyData.clientKey);
      const response = await fetch("/api/flights/offer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offerId: offer.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Could not refresh this flight offer.");
      }

     

      const passengers = Array.isArray(data?.passengers) ? data.passengers : [];

      setSelectedFlight(offer);
      setCheckoutOffer({
        id: data.id,
        totalAmount: data.totalAmount,
        totalCurrency: data.totalCurrency,
        expiresAt: data.expiresAt || null,
        liveMode: data.liveMode === true,
        passengers,
      });

      setPassengerForms(
        passengers.map((passenger: FlightCheckoutPassenger) => ({
          id: passenger.id,
          title: "mr",
          givenName: "",
          familyName: "",
          bornOn: "",
          gender: "m",
          email: "",
          phoneNumber: "",
        }))
      );
    } catch (error) {
      setCheckoutError(
        error instanceof Error ? error.message : "Could not prepare flight checkout."
      );
    } finally {
      setCheckoutLoading(false);
    }
  }

  function updatePassengerForm(
    passengerId: string,
    field: keyof Omit<FlightPassengerForm, "id">,
    value: string
  ) {
    setPassengerForms((current) =>
      current.map((passenger) =>
        passenger.id === passengerId
          ? { ...passenger, [field]: value }
          : passenger
      )
    );
  }

  async function createTestFlightOrder(sessionId?: string) {
    if (!checkoutOffer) return;

    const incompletePassenger = passengerForms.find(
      (passenger) =>
        !passenger.givenName.trim() ||
        !passenger.familyName.trim() ||
        !passenger.bornOn ||
        !passenger.email.trim() ||
        !passenger.phoneNumber.trim()
    );

    if (incompletePassenger) {
      setCheckoutError("Complete all passenger fields before creating the test booking.");
      return;
    }

    const normalizedPassengers = passengerForms.map((passenger) => ({
      ...passenger,
      phoneNumber: normalizePhoneForDuffel(passenger.phoneNumber),
    }));

    const invalidPhone = normalizedPassengers.find(
      (passenger) => !/^\+[1-9]\d{7,14}$/.test(passenger.phoneNumber)
    );

    if (invalidPhone) {
      setCheckoutError(
        "Enter a valid phone number. U.S. numbers can be entered normally, like (360) 555-1234."
      );
      return;
    }

    try {
      setOrderLoading(true);
      setCheckoutError("");

      const response = await fetch("/api/flights/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offerId: checkoutOffer.id,
          passengers: normalizedPassengers,
          threeDSecureSessionId: sessionId || threeDSecureSessionId,
          
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Duffel could not create the test order.");
      }

      const confirmation = {
        id: data.id,
        bookingReference: data.bookingReference || "Pending",
        totalAmount: data.totalAmount,
        totalCurrency: data.totalCurrency,
        passengerCount:
          Number.isFinite(Number(data.passengerCount)) && Number(data.passengerCount) > 0
            ? Number(data.passengerCount)
            : passengerForms.length,
        airline: data.airline || selectedFlight?.airline || "Airline",
        liveMode: data.liveMode === true,
      };

      setOrderConfirmation(confirmation);

      const confirmedAmount = Number(data.totalAmount);
      if (Number.isFinite(confirmedAmount) && confirmedAmount > 0 && data.id) {
        onRecordTripExpense({
          id: `flight-${data.id}`,
          category: "Flights",
          amount: confirmedAmount,
          currency: data.totalCurrency || "USD",
          label: `${confirmation.airline} • ${confirmation.bookingReference} • ${confirmation.passengerCount} ${
            confirmation.passengerCount === 1 ? "traveler" : "travelers"
          }`,
          source: "Duffel",
          testMode: data.liveMode !== true,
          createdAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      setCheckoutError(
        error instanceof Error ? error.message : "Could not create the Duffel test order."
      );
    } finally {
      setOrderLoading(false);
    }
  }

  function buildExpediaHotelUrl(
    stop: OvernightStop,
    destinationOverride?: string
  ) {
    const destination = destinationOverride || stop.location;

    const params = new URLSearchParams({
      destination,
      flexibility: "0_DAY",
      adults: getAdultCount(travelers).toString(),
      rooms: "1",

      // Current TrippinDays Expedia affiliate tracking from the
      // latest working Expedia Creator link supplied by the user.
      clickref: "1100lDp3r8rH",
      affcid: "US.DIRECT.PHG.1011l438666.1100l68075",
      ref_id: "1100lDp3r8rH",
      my_ad: "AFF.US.DIRECT.PHG.1011l438666.1100l68075",
      afflid: "1100lDp3r8rH",
      affdtl: "PHG.1100lDp3r8rH.PZfeWdmdK9",

      sort: "RECOMMENDED",
      useRewards: "false",
    });

    if (stop.checkIn) {
      params.set("d1", stop.checkIn);
      params.set("startDate", stop.checkIn);
    }

    if (stop.checkOut) {
      params.set("d2", stop.checkOut);
      params.set("endDate", stop.checkOut);
    }

    return `https://www.expedia.com/Hotel-Search?${params.toString()}`;
  }

  function buildNearbyExpediaUrl(stop: OvernightStop) {
    // Keep the real overnight city as the Expedia destination.
    // Appending phrases like "and nearby areas" can prevent Expedia
    // from resolving the destination and leave "Where to?" blank.
    return buildExpediaHotelUrl(stop, stop.location);
  }

  function buildMapsLodgingUrl(
    stop: OvernightStop,
    kind: "Hotels & Motels" | "Campgrounds & RV" | "Cabins & Lodges"
  ) {
    const query =
      kind === "Campgrounds & RV"
        ? `campgrounds and RV parks near ${stop.location}`
        : kind === "Cabins & Lodges"
          ? `cabins and lodges near ${stop.location}`
          : `hotels and motels near ${stop.location}`;

    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  }
  if (!liveChecks) {
    return (
<div
  className="rounded-3xl border border-sky-400/30 p-6"
  style={{
    backgroundColor: "red",
  }}
>
        <p className="text-sm font-black uppercase tracking-widest">Live weather</p>
        <h2 className="mt-3 text-2xl font-black">Weather location unavailable</h2>
        <p className="mt-3 leading-7">Check current conditions before leaving.</p>
      </div>
    );
  }

  return (
    <div
  className="rounded-3xl border border-sky-400/30 p-6"
  style={{
    backgroundImage: 'url("/images/sanfran.jpg")',
    backgroundSize: "cover",
    backgroundPosition: "center-right",
    backgroundRepeat: "no-repeat",
  }}
>
      <p className="text-sm font-black uppercase tracking-widest text-sky-300">
        Live destination weather
      </p>
      <h2 className="mt-3 text-3xl font-black">{liveChecks.location}</h2>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <InfoCard label="Temperature" value={formatTemperature(liveChecks.temperature)} />
        <InfoCard label="Feels Like" value={formatTemperature(liveChecks.feelsLike)} />
        <InfoCard
          label="High / Low"
          value={
            liveChecks.high === null || liveChecks.low === null
              ? "Unavailable"
              : `${Math.round(liveChecks.high)}° / ${Math.round(liveChecks.low)}°`
          }
        />
        <InfoCard
          label="Rain Chance"
          value={liveChecks.rainChance === null ? "Unavailable" : `${liveChecks.rainChance}%`}
        />
        <InfoCard
  label="UV Index"
  value={
    liveChecks.uvIndex == null
      ? "Unavailable"
      : `${liveChecks.uvIndex}`
  }
/>

<InfoCard
  label="Sunset"
  value={liveChecks.sunset || "Unavailable"}
/>

<InfoCard
  label="Wind Gusts"
  value={
    liveChecks.windGusts == null
      ? "Unavailable"
      : `${Math.round(liveChecks.windGusts)} mph`
  }
/>

<InfoCard
  label="Moon Phase"
  value={liveChecks.moonPhase || "Unavailable"}
/>
      </div>
<div className="mt-4 rounded-2xl bg-black/20 p-4">
  <p className="text-xs font-bold uppercase tracking-wider text-white/50">
    Travel Alerts
  </p>

  <p className="mt-2 font-bold">
    {liveChecks.alerts?.length
  ? liveChecks.alerts.join(" • ")
  : "✓ No active weather alerts"}
  </p>
</div>

{overnightStops.length > 0 && (
  <div className="mt-5 space-y-4">
    <p className="text-xs font-black uppercase tracking-wider text-cyan-300">
      Stay — Overnight Lodging
    </p>

    {overnightStops.map((stop, index) => {
      return (
        <div
          key={`${stop.stage}-${stop.location}-${index}`}
          className="rounded-2xl border border-white/10 bg-black/20 p-4"
        >
          <p className="text-xs font-black uppercase tracking-wider text-cyan-300">
            {stop.stage}
          </p>

          <h3 className="mt-1 text-lg font-black">
            🌙 {overnightStayLabel(stop)}
          </h3>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => setBookingChoice({ stop, kind: "Hotels & Motels" })}
              className="rounded-xl border border-white/10 bg-black/25 p-3 text-left transition hover:border-sky-300/40 hover:bg-black/35"
            >
              <div className="text-xl">🏨</div>
              <p className="mt-2 text-sm font-black">Hotels & Motels</p>
              <p className="mt-1 text-xs text-white/55">Book This Stop →</p>
            </button>

            <button
              type="button"
              onClick={() => setBookingChoice({ stop, kind: "Campgrounds & RV" })}
              className="rounded-xl border border-white/10 bg-black/25 p-3 text-left transition hover:border-sky-300/40 hover:bg-black/35"
            >
              <div className="text-xl">⛺</div>
              <p className="mt-2 text-sm font-black">Campgrounds & RV</p>
              <p className="mt-1 text-xs text-white/55">Search This Stop →</p>
            </button>

            <button
              type="button"
              onClick={() => setBookingChoice({ stop, kind: "Cabins & Lodges" })}
              className="rounded-xl border border-white/10 bg-black/25 p-3 text-left transition hover:border-sky-300/40 hover:bg-black/35"
            >
              <div className="text-xl">🛖</div>
              <p className="mt-2 text-sm font-black">Cabins & Lodges</p>
              <p className="mt-1 text-xs text-white/55">Book This Stop →</p>
            </button>
          </div>


        </div>
      );
    })}
  </div>
)}


<div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
  <p className="text-xs font-black uppercase tracking-wider text-cyan-300">
    Transportation
  </p>
  <p className="mt-1 text-sm text-white/60">
    Search flights, trains, and buses without re-entering your whole trip.
  </p>

  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
    <button
      type="button"
      onClick={() => setFlightOpen(true)}
      className="rounded-xl border border-white/10 bg-black/25 p-4 text-left transition hover:border-sky-300/40 hover:bg-black/35"
    >
      <div className="text-2xl">✈️</div>
      <p className="mt-2 font-black">Flights</p>
      <p className="mt-1 text-xs text-white/55">Search flights for this trip →</p>
    </button>

    <button
      type="button"
      onClick={() => setTrainBusOpen(true)}
      className="rounded-xl border border-white/10 bg-black/25 p-4 text-left transition hover:border-emerald-300/40 hover:bg-black/35"
    >
      <div className="text-2xl">🚆</div>
      <p className="mt-2 font-black">Trains & Buses</p>
      <p className="mt-1 text-xs text-white/55">
        Search live Omio rail and bus options →
      </p>
    </button>
  </div>
</div>


<div
  className={
    trainBusOpen
      ? "fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/75 p-4"
      : "hidden"
  }
  role="dialog"
  aria-modal={trainBusOpen ? "true" : undefined}
  aria-label="Train and bus search"
  onClick={() => setTrainBusOpen(false)}
>
  <div
    className="my-8 w-full max-w-4xl rounded-3xl border border-white/15 bg-[#0b1b2f] p-6 shadow-2xl"
    onClick={(event) => event.stopPropagation()}
  >
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-emerald-300">
          Book Your Trip
        </p>
        <h3 className="mt-2 text-3xl font-black">🚆 Find Trains & Buses</h3>
        <p className="mt-2 text-sm text-white/60">
          Search live routes with Omio. Bookings completed through Omio support TrippinDays through our affiliate partnership.
        </p>
      </div>

      <button
        type="button"
        onClick={() => setTrainBusOpen(false)}
        className="rounded-full border border-white/15 px-3 py-2 font-black hover:bg-white/10"
        aria-label="Close train and bus search"
      >
        ✕
      </button>
    </div>

    <div className="mt-5 grid gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 sm:grid-cols-2 lg:grid-cols-4">
      <InfoCard label="From" value={origin || "Starting location"} />
      <InfoCard label="To" value={destination || "Destination"} />
      <InfoCard label="Depart" value={tripDate || "Choose in Omio"} />
      <InfoCard
        label="Return"
        value={flightReturnDate || "One way / choose in Omio"}
      />
    </div>

    <p className="mt-3 text-xs text-white/45">
      👥 {getAdultCount(travelers)} adult traveler(s) • Dates are prefilled from this itinerary. Omio handles live origin/destination selection, availability, fares, and checkout.
    </p>

    <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-5">
  <p className="text-sm leading-6 text-white/70">
    Compare live train and bus options for this trip with Omio.
  </p>

  <a
    href="https://omio.sjv.io/Gb4M1k"
    target="_blank"
    rel="noopener noreferrer sponsored"
    className="mt-4 flex min-h-[56px] w-full items-center justify-center rounded-2xl bg-emerald-500 px-6 py-4 text-center font-black text-slate-950 transition hover:bg-emerald-400"
  >
    Search Trains &amp; Buses on Omio →
  </a>
</div>

    <p className="mt-3 text-center text-xs text-white/40">
      Powered by Omio • Affiliate tracking enabled for TrippinDays
    </p>
  </div>
</div>

{flightOpen && (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/75 p-4"
    role="dialog"
    aria-modal="true"
    aria-label="Flight search"
    onClick={() => setFlightOpen(false)}
  >
    <div
      className="my-8 w-full max-w-3xl rounded-3xl border border-white/15 bg-[#0b1b2f] p-6 shadow-2xl"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-cyan-300">
            Book Your Trip
          </p>
          <h3 className="mt-2 text-3xl font-black">✈️ Find Flights</h3>
          <p className="mt-2 text-sm text-white/60">
            TrippinDays fills in your trip details and Duffel searches available flight offers.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setFlightOpen(false)}
          className="rounded-full border border-white/15 px-3 py-2 font-black hover:bg-white/10"
          aria-label="Close flight search"
        >
          ✕
        </button>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-bold text-white/80">
          Departing Airport
          <input
            value={flightOrigin}
            onChange={(event) => setFlightOrigin(event.target.value.toUpperCase())}
            placeholder="Finding airport..."
            className="mt-2 w-full rounded-xl border border-white/15 bg-slate-950/70 p-3 text-white outline-none focus:border-sky-400"
          />
        </label>

        <label className="text-sm font-bold text-white/80">
          Arrival Airport
          <input
            value={flightDestination}
            onChange={(event) => setFlightDestination(event.target.value.toUpperCase())}
            placeholder="Finding airport..."
            className="mt-2 w-full rounded-xl border border-white/15 bg-slate-950/70 p-3 text-white outline-none focus:border-sky-400"
          />
        </label>

        <label className="text-sm font-bold text-white/80">
          Departure
          <input
            type="date"
            value={flightDepartureDate}
            onChange={(event) => setFlightDepartureDate(event.target.value)}
            className="mt-2 w-full rounded-xl border border-white/15 bg-slate-950/70 p-3 text-white outline-none focus:border-sky-400"
          />
        </label>

        <label className="text-sm font-bold text-white/80">
          Return <span className="text-white/40">(optional)</span>
          <input
            type="date"
            value={flightReturnDate}
            onChange={(event) => setFlightReturnDate(event.target.value)}
            min={flightDepartureDate || undefined}
            className="mt-2 w-full rounded-xl border border-white/15 bg-slate-950/70 p-3 text-white outline-none focus:border-sky-400"
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-black/20 p-4">
        <p className="font-bold">👥 {getAdultCount(travelers)} adult traveler(s)</p>
        <button
          type="button"
          onClick={() => void searchFlights()}
          disabled={flightLoading || airportResolving}
          className="rounded-xl bg-sky-500 px-5 py-3 font-black text-white hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {airportResolving
            ? "Finding Airports..."
            : flightLoading
              ? "Searching Flights..."
              : "Search Flights →"}
        </button>
      </div>

      {resolvedFlightRoute && (
        <p className="mt-4 rounded-xl bg-emerald-500/10 p-3 text-sm font-bold text-emerald-200">
          Airport match: {resolvedFlightRoute}
        </p>
      )}

      {flightError && (
        <p className="mt-4 rounded-xl border border-red-400/25 bg-red-500/10 p-3 text-sm font-bold text-red-100">
          {flightError}
        </p>
      )}

      {flightOffers.length > 0 && (
        <div className="mt-5 space-y-4">
          {!selectedOutboundKey ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-xl font-black">Choose Your Outbound Flight</h4>
                  <p className="mt-1 text-sm text-white/55">
                    Pick the flight going to your destination first.
                  </p>
                </div>
                <p className="text-xs text-white/45">Live flight inventory</p>
              </div>

              {uniqueOutboundOffers.map((offer) => {
                const matchingBundles = flightOffers.filter(
                  (candidate) => outboundKey(candidate) === outboundKey(offer)
                );

                const lowestBundle = matchingBundles.reduce((lowest, candidate) => {
                  const lowestValue = Number(lowest.totalAmount);
                  const candidateValue = Number(candidate.totalAmount);

                  if (!Number.isFinite(lowestValue)) return candidate;
                  if (!Number.isFinite(candidateValue)) return lowest;
                  return candidateValue < lowestValue ? candidate : lowest;
                }, matchingBundles[0] || offer);

                return (
                  <button
                    key={outboundKey(offer)}
                    type="button"
                    onClick={() => {
                      if (offer.returnOrigin && offer.returnDestination) {
                        setSelectedOutboundKey(outboundKey(offer));
                        setCheckoutError("");
                        setOrderConfirmation(null);
                      } else {
                        void prepareFlightCheckout(offer);
                      }
                    }}
                    disabled={checkoutLoading}
                    aria-label={`Choose outbound flight ${offer.origin} to ${offer.destination}`}
                    className="w-full rounded-2xl border border-sky-400/20 bg-black/25 p-4 text-left transition hover:-translate-y-0.5 hover:border-sky-300/60 hover:bg-sky-500/10 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-sky-400/70 disabled:cursor-wait disabled:opacity-60"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        {offer.airlineLogo ? (
                          <img
                            src={offer.airlineLogo}
                            alt=""
                            className="h-10 w-10 rounded-lg bg-white object-contain p-1"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10">
                            ✈️
                          </div>
                        )}

                        <div>
                          <p className="font-black">{offer.airline}</p>
                          <p className="text-xs font-black uppercase tracking-widest text-sky-300">
                            Outbound Flight
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="text-sm font-black text-emerald-300">
                          Round trips from {lowestBundle.totalCurrency} {lowestBundle.totalAmount}
                        </p>
                        <p className="mt-1 text-xs text-white/45">
                          Return flight chosen next
                        </p>
                      </div>
                    </div>

                    <p className="mt-3 text-lg font-black">
                      {offer.origin} → {offer.destination}
                    </p>

                    <div className="mt-3 grid gap-2 text-sm text-white/70 sm:grid-cols-3">
                      <p>
                        🛫{" "}
                        {offer.departureTime
                          ? new Date(offer.departureTime).toLocaleString()
                          : "Departure time unavailable"}
                      </p>
                      <p>
                        🛬{" "}
                        {offer.arrivalTime
                          ? new Date(offer.arrivalTime).toLocaleString()
                          : "Arrival time unavailable"}
                      </p>
                      <p>⏱️ {offer.duration || "Duration unavailable"}</p>
                    </div>

                    <p className="mt-3 text-xs font-bold text-white/55">
                      {offer.stops === 0
                        ? "Nonstop"
                        : `${offer.stops} stop${offer.stops === 1 ? "" : "s"}`}
                    </p>
                  </button>
                );
              })}
            </>
          ) : (
            <>
              <div className="rounded-2xl border border-sky-400/25 bg-sky-500/10 p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-sky-300">
                      ✓ Outbound Selected
                    </p>
                    {selectedOutbound && (
                      <>
                        <p className="mt-2 text-lg font-black">
                          {selectedOutbound.origin} → {selectedOutbound.destination}
                        </p>
                        <p className="mt-1 text-sm text-white/70">
                          {selectedOutbound.departureTime
                            ? new Date(selectedOutbound.departureTime).toLocaleString()
                            : "Departure time unavailable"}
                        </p>
                        <p className="mt-1 text-sm font-bold text-white/75">
                          {selectedOutbound.airline}
                        </p>
                      </>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedOutboundKey("")}
                    disabled={checkoutLoading}
                    className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-black transition hover:bg-white/10 disabled:opacity-50"
                  >
                    ← Change Outbound
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-xl font-black">Choose Your Return Flight</h4>
                  <p className="mt-1 text-sm text-white/55">
                    These return flights are valid with the outbound flight you selected.
                  </p>
                </div>
                <p className="text-xs text-white/45">Step 2 of 2</p>
              </div>

              {selectedOutboundOffers
                .filter((offer) => offer.returnOrigin && offer.returnDestination)
                .map((offer) => (
                  <button
                    key={offer.id}
                    type="button"
                    onClick={() => void prepareFlightCheckout(offer)}
                    disabled={checkoutLoading}
                    aria-label={`Choose return flight ${offer.returnOrigin} to ${offer.returnDestination}`}
                    className="w-full rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-4 text-left transition hover:-translate-y-0.5 hover:border-cyan-300/70 hover:bg-cyan-500/20 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-cyan-400/70 disabled:cursor-wait disabled:opacity-60"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-black uppercase tracking-widest text-cyan-300">
                          Return Flight
                        </p>
                        <p className="mt-2 text-lg font-black">
                          {offer.returnOrigin} → {offer.returnDestination}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-2xl font-black text-emerald-300">
                          {offer.totalCurrency} {offer.totalAmount}
                        </p>
                        <p className="text-xs font-bold text-white/55">
                          Round-trip total
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2 text-sm text-white/75 sm:grid-cols-3">
                      <p>
                        🛫{" "}
                        {offer.returnDepartureTime
                          ? new Date(offer.returnDepartureTime).toLocaleString()
                          : "Departure time unavailable"}
                      </p>

                      <p>
                        🛬{" "}
                        {offer.returnArrivalTime
                          ? new Date(offer.returnArrivalTime).toLocaleString()
                          : "Arrival time unavailable"}
                      </p>

                      <p>⏱️ {offer.returnDuration || "Duration unavailable"}</p>
                    </div>

                    <p className="mt-3 text-xs font-bold text-white/55">
                      {offer.returnStops === 0
                        ? "Nonstop"
                        : offer.returnStops !== null
                          ? `${offer.returnStops} stop${offer.returnStops === 1 ? "" : "s"}`
                          : ""}
                    </p>

                    {offer.operatingCarriers?.length > 0 && (
                      <p className="mt-2 text-xs leading-5 text-white/50">
                        Operated by: {offer.operatingCarriers.join(", ")}
                      </p>
                    )}

                    {checkoutLoading && (
                      <p className="mt-3 text-sm font-black text-emerald-300">
                        Refreshing...
                      </p>
                    )}
                  </button>
                ))}
            </>
          )}

          <p className="border-t border-white/10 pt-3 text-xs leading-5 text-white/45">
            Test mode only. TrippinDays refreshes the complete Duffel round-trip offer before passenger checkout because airline prices and availability can change.
          </p>
        </div>
      )}
    </div>
  </div>
)}

{checkoutOffer && selectedFlight && (
  <div
    className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-black/85 p-4"
    role="dialog"
    aria-modal="true"
    aria-label="Secure flight checkout"
    onClick={() => {
      if (!orderLoading) {
        setCheckoutOffer(null);
        setSelectedFlight(null);
        setCheckoutError("");
        setOrderConfirmation(null);
      }
    }}
  >
    <div
      className="my-8 w-full max-w-3xl rounded-3xl border border-emerald-400/25 bg-[#071526] p-6 shadow-2xl"
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => {
          if (!orderLoading) {
            setCheckoutOffer(null);
            setSelectedFlight(null);
            setCheckoutError("");
            setOrderConfirmation(null);
          }
        }}
        disabled={orderLoading}
        className="mb-5 inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-black text-white transition hover:bg-white/10 disabled:opacity-50"
      >
        ← Back to Flight Results
      </button>

      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-amber-300">
            Secure Flight Checkout
          </p>
          <h3 className="mt-2 text-3xl font-black">Passenger Checkout</h3>
          <p className="mt-2 text-sm text-white/60">
            This creates a Duffel TEST order only. No real airline ticket or real-money charge is created.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (!orderLoading) {
              setCheckoutOffer(null);
              setSelectedFlight(null);
              setCheckoutError("");
              setOrderConfirmation(null);
            }
          }}
          className="rounded-full border border-white/15 px-3 py-2 font-black hover:bg-white/10"
          aria-label="Close flight checkout"
        >
          ✕
        </button>
      </div>

      <div className="mt-5 grid gap-3 rounded-2xl border border-white/10 bg-black/25 p-4 sm:grid-cols-3">
        <InfoCard
          label="Flight"
          value={`${selectedFlight.origin} → ${selectedFlight.destination}`}
        />
        <InfoCard
          label="Airline"
          value={selectedFlight.airline}
        />
        <InfoCard
          label="Current Duffel Price"
          value={`${checkoutOffer.totalCurrency} ${checkoutOffer.totalAmount}`}
        />
      </div>

      {checkoutOffer.expiresAt && (
        <p className="mt-3 text-xs font-bold text-amber-200/80">
          Offer expires: {new Date(checkoutOffer.expiresAt).toLocaleString()}
        </p>
      )}

      {orderConfirmation ? (
        <div className="mt-6 rounded-3xl border border-emerald-400/35 bg-emerald-500/10 p-6 shadow-xl">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-black uppercase tracking-widest text-emerald-300">
                ✅ Booking Confirmed
              </p>
              <h4 className="mt-2 text-3xl font-black">
                {orderConfirmation.liveMode
                  ? "Your Flight Is Booked"
                  : "Your Test Flight Is Booked"}
              </h4>
              <p className="mt-2 text-sm text-white/60">
                Keep this booking reference handy for your trip records.
              </p>
            </div>

            {!orderConfirmation.liveMode && (
              <span className="rounded-full border border-amber-300/30 bg-amber-400/10 px-3 py-1 text-xs font-black uppercase tracking-widest text-amber-200">
                Test Mode
              </span>
            )}
          </div>

          <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-5">
            <p className="text-xs font-black uppercase tracking-widest text-white/45">
              Booking Reference
            </p>
            <p className="mt-1 text-3xl font-black tracking-wide text-emerald-300">
              {orderConfirmation.bookingReference}
            </p>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <InfoCard label="Airline" value={orderConfirmation.airline} />
            <InfoCard
              label="Total"
              value={`${orderConfirmation.totalCurrency} ${orderConfirmation.totalAmount}`}
            />
            <InfoCard
              label="Outbound"
              value={`${selectedFlight.origin} → ${selectedFlight.destination}${
                selectedFlight.departureTime
                  ? ` • ${new Date(selectedFlight.departureTime).toLocaleString()}`
                  : ""
              }`}
            />
            <InfoCard
              label={selectedFlight.returnOrigin ? "Return" : "Trip Type"}
              value={
                selectedFlight.returnOrigin && selectedFlight.returnDestination
                  ? `${selectedFlight.returnOrigin} → ${selectedFlight.returnDestination}${
                      selectedFlight.returnDepartureTime
                        ? ` • ${new Date(selectedFlight.returnDepartureTime).toLocaleString()}`
                        : ""
                    }`
                  : "One way"
              }
            />
          </div>

          {!orderConfirmation.liveMode && (
            <p className="mt-4 text-sm leading-6 text-white/60">
              This is a Duffel test booking only. No real ticket was issued and no real money was charged.
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="mt-6 space-y-5">
            {passengerForms.map((passenger, index) => (
              <div
                key={passenger.id}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"
              >
                <h4 className="text-lg font-black">Passenger {index + 1}</h4>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="text-sm font-bold text-white/80">
                    Title
                    <select
                      value={passenger.title}
                      onChange={(event) =>
                        updatePassengerForm(
                          passenger.id,
                          "title",
                          event.target.value
                        )
                      }
                      className="mt-2 w-full rounded-xl border border-white/15 bg-slate-950/70 p-3 text-white"
                    >
                      <option value="mr">Mr</option>
                      <option value="mrs">Mrs</option>
                      <option value="ms">Ms</option>
                      <option value="miss">Miss</option>
                      <option value="dr">Dr</option>
                    </select>
                  </label>

                  <label className="text-sm font-bold text-white/80">
                    Gender
                    <select
                      value={passenger.gender}
                      onChange={(event) =>
                        updatePassengerForm(
                          passenger.id,
                          "gender",
                          event.target.value
                        )
                      }
                      className="mt-2 w-full rounded-xl border border-white/15 bg-slate-950/70 p-3 text-white"
                    >
                      <option value="m">Male</option>
                      <option value="f">Female</option>
                    </select>
                  </label>

                  <label className="text-sm font-bold text-white/80">
                    Legal first name
                    <input
                      value={passenger.givenName}
                      onChange={(event) =>
                        updatePassengerForm(
                          passenger.id,
                          "givenName",
                          event.target.value
                        )
                      }
                      className="mt-2 w-full rounded-xl border border-white/15 bg-slate-950/70 p-3 text-white"
                    />
                  </label>

                  <label className="text-sm font-bold text-white/80">
                    Legal last name
                    <input
                      value={passenger.familyName}
                      onChange={(event) =>
                        updatePassengerForm(
                          passenger.id,
                          "familyName",
                          event.target.value
                        )
                      }
                      className="mt-2 w-full rounded-xl border border-white/15 bg-slate-950/70 p-3 text-white"
                    />
                  </label>

                  <label className="text-sm font-bold text-white/80">
                    Date of birth
                    <input
                      type="date"
                      value={passenger.bornOn}
                      onChange={(event) =>
                        updatePassengerForm(
                          passenger.id,
                          "bornOn",
                          event.target.value
                        )
                      }
                      className="mt-2 w-full rounded-xl border border-white/15 bg-slate-950/70 p-3 text-white"
                    />
                  </label>

                  <label className="text-sm font-bold text-white/80">
                    Passenger email
                    <input
                      type="email"
                      value={passenger.email}
                      onChange={(event) =>
                        updatePassengerForm(
                          passenger.id,
                          "email",
                          event.target.value
                        )
                      }
                      className="mt-2 w-full rounded-xl border border-white/15 bg-slate-950/70 p-3 text-white"
                    />
                  </label>
{componentClientKey && (
  <div className="mt-4">
    <DuffelCardForm
      ref={cardFormRef}
      clientKey={componentClientKey}
      intent="to-create-card-for-temporary-use"
      onValidateSuccess={() => setCardReady(true)}
      onValidateFailure={() => setCardReady(false)}
      onCreateCardForTemporaryUseSuccess={async (card) => {
  try {
    setTemporaryCardId(card.id);

    const session = await createThreeDSecureSession(
      componentClientKey,
      card.id,
      checkoutOffer?.id || "",
      [],
      true
    );

    if (session.status !== "ready_for_payment") {
      throw new Error("3D Secure verification was not completed.");
    }

    setThreeDSecureSessionId(session.id);
    await createTestFlightOrder(session.id);
  } catch (error) {
    setCheckoutError(
      error instanceof Error
        ? error.message
        : "Could not verify the payment card."
    );
  }
}}
onCreateCardForTemporaryUseFailure={(error) => {
  setTemporaryCardId("");
  setCheckoutError(
    error?.message || "Could not prepare the payment card."
  );
}}
    />
  </div>
)}

                  <label className="text-sm font-bold text-white/80 sm:col-span-2">
                    Passenger phone number
                    <input
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      value={passenger.phoneNumber}
                      onChange={(event) =>
                        updatePassengerForm(
                          passenger.id,
                          "phoneNumber",
                          event.target.value
                        )
                      }
                      onBlur={(event) =>
                        updatePassengerForm(
                          passenger.id,
                          "phoneNumber",
                          formatPhoneForDisplay(event.target.value)
                        )
                      }
                      placeholder="(360) 555-1234"
                      className="mt-2 w-full rounded-xl border border-white/15 bg-slate-950/70 p-3 text-white"
                    />
                    <span className="mt-2 block text-xs font-medium text-white/45">
                      Enter it normally. TrippinDays formats it automatically for the airline.
                    </span>
                  </label>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4 text-sm leading-6 text-amber-100/85">
            Secure payment is handled by Duffel. TrippinDays does not receive or store your card number.
          </div>

          {checkoutError && (
            <p className="mt-4 rounded-xl border border-red-400/25 bg-red-500/10 p-3 text-sm font-bold text-red-100">
              {checkoutError}
            </p>
          )}

          <button
            type="button"
            onClick={() => void createCardForTemporaryUse()}
            disabled={orderLoading || !cardReady}
            className="mt-5 w-full rounded-xl bg-emerald-500 px-5 py-4 font-black text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {orderLoading ? "Booking Flight..." : "Pay & Book Flight →"}
          </button>
        </>
      )}
    </div>
  </div>
)}

{bookingChoice && (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
    role="dialog"
    aria-modal="true"
    aria-label="Lodging booking details"
    onClick={() => setBookingChoice(null)}
  >
    <div
      className="w-full max-w-lg rounded-3xl border border-white/15 bg-[#0b1b2f] p-6 shadow-2xl"
      onClick={(event) => event.stopPropagation()}
    >
      <p className="text-xs font-black uppercase tracking-widest text-cyan-300">
        {bookingChoice.stop.stage}
      </p>

      <h3 className="mt-2 text-2xl font-black">
        {bookingChoice.kind}
      </h3>

      <div className="mt-5 space-y-3 rounded-2xl bg-black/25 p-4">
        <p className="font-bold">📍 {bookingChoice.stop.location}</p>

        {bookingChoice.stop.checkIn && (
          <p className="font-bold">
            📅 Check-in: {formatBookingDate(bookingChoice.stop.checkIn)}
          </p>
        )}

        {bookingChoice.stop.checkOut && (
          <p className="font-bold">
            📅 Check-out: {formatBookingDate(bookingChoice.stop.checkOut)}
          </p>
        )}

        <p className="font-bold">👥 Travelers: {travelers}</p>
      </div>

      <p className="mt-4 text-sm leading-6 text-white/65">
        Expedia will open with this overnight stop, dates, and traveler count already filled in through the TrippinDays affiliate booking link.
      </p>

      <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/5 p-4">
        <p className="text-sm font-black text-amber-200">
          No Expedia matches?
        </p>
        <p className="mt-1 text-xs leading-5 text-white/55">
          Try a broader Expedia search first so TrippinDays can still receive affiliate credit. If that still does not work, use Maps to find lodging near this overnight area.
        </p>

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => {
              const nearbyUrl = buildNearbyExpediaUrl(bookingChoice.stop);
              window.open(nearbyUrl, "_blank", "noopener,noreferrer");
            }}
            className="rounded-xl border border-amber-300/25 bg-black/20 px-4 py-3 text-sm font-black hover:bg-black/35"
          >
            Search Nearby on Expedia →
          </button>

          <button
            type="button"
            onClick={() => {
              const mapsUrl = buildMapsLodgingUrl(
                bookingChoice.stop,
                bookingChoice.kind
              );
              window.open(mapsUrl, "_blank", "noopener,noreferrer");
            }}
            className="rounded-xl border border-white/15 bg-black/20 px-4 py-3 text-sm font-black hover:bg-black/35"
          >
            Find Nearby in Maps →
          </button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setBookingChoice(null)}
          className="rounded-2xl border border-white/15 px-5 py-3 font-black hover:bg-white/10"
        >
          Back
        </button>

        <button
          type="button"
          onClick={() => {
            const expediaUrl = buildExpediaHotelUrl(bookingChoice.stop);
            window.open(expediaUrl, "_blank", "noopener,noreferrer");
            setBookingChoice(null);
          }}
          className="rounded-2xl bg-sky-500 px-5 py-3 font-black text-white hover:bg-sky-400"
        >
          Continue to Expedia →
        </button>
      </div>
    </div>
  </div>
)}



     
    </div>
    
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-black/20 p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-white/45">
        {label}
      </p>
      <p className="mt-2 font-black">{value}</p>
    </div>
  );
}

function LoadingPanel() {
  return (
    <section className="flex min-h-[78vh] items-center justify-center py-8 text-center">
      <div className="w-full max-w-xl rounded-3xl border border-white/20 bg-slate-950/45 p-8 shadow-2xl backdrop-blur-sm sm:p-10">
        <div className="animate-bounce text-7xl drop-shadow-lg">🧭</div>

        <h1 className="mt-5 text-3xl font-black text-white drop-shadow-lg sm:text-4xl">
          Finding Your Best Adventure
        </h1>

        <p className="mt-3 text-base font-semibold text-white/85 sm:text-lg">
          TrippinDays is building your adventure...
        </p>

        <div className="mx-auto mt-8 max-w-md space-y-3 text-left text-base font-semibold text-white sm:text-lg">
          <p>🧠 Understanding your request</p>
          <p>📍 Comparing destinations</p>
          <p>💰 Matching your budget</p>
          <p>🚗 Estimating the drive</p>
          <p>🌤️ Checking live weather</p>
          <p>🎵 Building RoadTunes suggestions</p>
        </div>

        <div className="mx-auto mt-8 h-11 w-11 animate-spin rounded-full border-4 border-white/30 border-t-white" />
      </div>
    </section>
  );
}

function getValue(text: string, label: string) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = text.match(new RegExp(`^${escaped}:\\s*(.+)$`, "im"));
  return match?.[1]?.trim() || "";
}

function parseOvernightStops(
  plan: string,
  tripStartDate: string,
  _finalDestination: string
): OvernightStop[] {
  const lines = plan
    .replace(/\r/g, "")
    .split("\n")
    .map((line) =>
      line
        .trim()
        .replace(/^#{1,6}\s*/, "")
        .replace(/^\*\*(.+)\*\*$/, "$1")
    )
    .filter(Boolean);

  const stops: OvernightStop[] = [];
  let currentDay = "";
  let currentDayNumber: number | null = null;
  let overnightNumber = 0;

  for (const line of lines) {
    const dayMatch = line.match(/^day\s*(\d+)\b(.*)$/i);

    if (dayMatch) {
      currentDayNumber = Number(dayMatch[1]);
      const extra = dayMatch[2]?.replace(/^[-–—:\s]+/, "").trim();
      currentDay = extra
        ? `Day ${currentDayNumber} — ${extra}`
        : `Day ${currentDayNumber}`;
    }

    const tonightMatch = line.match(/^tonight\s+in\s+(.+?)[:.]?$/i);

    if (tonightMatch) {
      overnightNumber += 1;

      const checkIn =
        tripStartDate && currentDayNumber
          ? addCalendarDays(tripStartDate, currentDayNumber - 1)
          : "";

      const checkOut =
        tripStartDate && currentDayNumber
          ? addCalendarDays(tripStartDate, currentDayNumber)
          : "";

      stops.push({
        stage: currentDay || `Overnight Stop ${overnightNumber}`,
        location: tonightMatch[1].replace(/[:.]$/, "").trim(),
        dayNumber: currentDayNumber,
        checkIn,
        checkOut,
      });
    }
  }

  // Only render lodging that the itinerary explicitly marks with
  // "TONIGHT IN ...". Do not manufacture an extra stay from the trip's
  // final destination. This prevents a Friday-Sunday weekend trip from
  // incorrectly showing a third (Sunday-night) lodging card after the
  // traveler is already scheduled to return home.
  return stops;
}

function overnightStayLabel(stop: OvernightStop): string {
  const datePart = stop.stage
    .replace(/^Day\s*\d+\s*[—–-]?\s*/i, "")
    .trim();

  if (datePart && !/^Day\s*\d+$/i.test(stop.stage)) {
    return `${datePart} — ${stop.location}`;
  }

  return `Stay — ${stop.location}`;
}

function getAdultCount(travelers: string): number {
  const value = travelers.toLowerCase();

  const explicitAdults = value.match(/(\d+)\s*adults?/i);
  if (explicitAdults) return Math.max(1, Number(explicitAdults[1]));

  if (value.includes("couple")) return 2;
  if (value.includes("just me") || value.includes("solo")) return 1;
  if (value.includes("me and my dog")) return 1;
  if (value.includes("friends")) return 2;
  if (value.includes("family")) return 2;

  const leadingNumber = value.match(/^\s*(\d+)\b/);
  if (leadingNumber) return Math.max(1, Number(leadingNumber[1]));

  return 1;
}

function addCalendarDays(dateText: string, days: number): string {
  const match = dateText.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";

  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  );

  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatBookingDate(dateText: string): string {
  const match = dateText.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return dateText;

  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  );

  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function parseDetourStops(plan: string): DetourStop[] {
  if (!plan.trim()) return [];

  const lines = plan.split("\n");
  const headingIndex = lines.findIndex((line) =>
    /^\s*(?:#{1,6}\s*)?(?:🧭\s*)?detour[- ]worthy stops\s*:?.*$/i.test(line.trim())
  );

  if (headingIndex === -1) return [];

  const collected: string[] = [];
  for (let i = headingIndex + 1; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;
    if (/^(?:#{1,6}\s*)?(?:day\s+\d+|weather|roadtunes|music|budget|cost|check before leaving|tonight in|itinerary)\b/i.test(line)) {
      break;
    }
    collected.push(line);
  }

  return collected
    .map((line) => line.replace(/^[-*•]\s*/, "").replace(/^\d+[.)]\s*/, ""))
    .map((line) => {
      const parts = line.split("|").map((part) => part.trim());
      if (parts.length < 3) return null;
      const [name = "", area = "", detourTime = "", detourMiles = "", ...reasonParts] = parts;
      return {
        name: name.replace(/^name:\s*/i, ""),
        area: area.replace(/^(?:area|location):\s*/i, ""),
        detourTime: detourTime.replace(/^detour time:\s*/i, ""),
        detourMiles: detourMiles.replace(/^detour miles:\s*/i, ""),
        reason: reasonParts.join(" | ").replace(/^(?:why|reason):\s*/i, ""),
      };
    })
    .filter((stop): stop is DetourStop => Boolean(stop?.name))
    .slice(0, 5);
}

function parsePlan(plan: string, fallbackDestination: string): Section[] {
  const lines = plan
    .replace(/\r/g, "")
    .split("\n")
    .map((line) =>
      line
        .trim()
        .replace(/^#{1,6}\s*/, "")
        .replace(/^\*\*(.+)\*\*$/, "$1")
    )
    .filter(Boolean);

  if (!lines.length) return [];

  const sections: Section[] = [];
  let current: Section | null = null;

  for (const raw of lines) {
    const line = raw.trim();

    if (isHeading(line)) {
      if (current && current.lines.length) sections.push(current);

      const title = cleanHeading(line);

      current = {
        title,
        emoji: chooseEmoji(title),
        lines: [],
        navigationQuery: navigationQuery(title),
      };

      continue;
    }

    if (!current) {
      current = {
        title: fallbackDestination || "Adventure Overview",
        emoji: "🚗",
        lines: [],
        navigationQuery: fallbackDestination || null,
      };
    }

    current.lines.push(line.replace(/^[-•]\s*/, ""));
  }

  if (current) sections.push(current);

  const useful = sections
    .filter((section) => section.lines.length)
    .slice(0, 12);

  return useful.length
    ? useful
    : [
        {
          title: fallbackDestination || "Your Adventure",
          emoji: "🚗",
          lines,
          navigationQuery: fallbackDestination || null,
        },
      ];
}

function isHeading(line: string) {
  return (
    /^\d{1,2}(:\d{2})?\s*(AM|PM)?\s*[-–—:]/i.test(line) ||
    /^(morning|afternoon|evening|breakfast|lunch|dinner|departure|arrival|return|stop\s*\d+|day\s*\d+|tonight\s+in|hotel\s*\/?\s*motel|campground\s*\/?\s*rv|cabin\s*\/?\s*alternative|detour-worthy stops|roadtunes|weather|cost|budget|check before leaving)/i.test(
      line
    ) ||
    (line.length < 70 && /:$/.test(line))
  );
}

function cleanHeading(line: string) {
  return line.replace(/:$/, "").replace(/^\d+\.\s*/, "").trim();
}

function navigationQuery(title: string) {
  const cleaned = title
    .replace(/^\d{1,2}(:\d{2})?\s*(AM|PM)?\s*[-–—:]\s*/i, "")
    .replace(
      /^(stop\s*\d+|morning|afternoon|evening|breakfast|lunch|dinner|departure|arrival)\s*[-–—:]\s*/i,
      ""
    )
    .trim();

  if (
    !cleaned ||
    /^(weather|roadtunes|cost|budget|check before leaving|return home)$/i.test(
      cleaned
    )
  ) {
    return null;
  }

  return cleaned;
}

function chooseEmoji(title: string) {
  const value = title.toLowerCase();

  if (/breakfast|lunch|dinner|food/.test(value)) return "🍽️";
  if (/waterfall|falls/.test(value)) return "💦";
  if (/ghost|historic/.test(value)) return "👻";
  if (/church|worship|cathedral|temple/.test(value)) return "⛪";
  if (/hike|trail|walk/.test(value)) return "🥾";
  if (/weather|check before/.test(value)) return "🌤️";
  if (/music|roadtunes|song/.test(value)) return "🎵";
  if (/cost|budget/.test(value)) return "💵";
  if (/return|home/.test(value)) return "🏠";

  return "📍";
}

function decorateLine(line: string) {
  if (/^(estimated|cost|price|budget)/i.test(line))
    return <>💵 {line}</>;

  if (/^(drive|distance|travel|depart|arrive)/i.test(line))
    return <>🚗 {line}</>;

  if (/^(why|reason|best|highlight)/i.test(line))
    return <>⭐ {line}</>;

  if (/^(warning|alert|check|closure)/i.test(line))
    return <>⚠️ {line}</>;

  
}
function formatTemperature(value: number | null) {
  return value === null ? "Unavailable" : `${Math.round(value)}°F`;
}

