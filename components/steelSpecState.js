'use client'
import { useState, useEffect, useCallback } from "react";
import {
  resolveSteelDoor, validateSteelDoor, highPerformanceAvailable,
} from "../lib/steelDoor";
import { REQUIRE_ENQUIRY_DETAILS, isEmail, isPhone } from "../lib/hardwareSpec";
import { generateSteelDoorPDF } from "../lib/generateSteelDoorPDF";

// ─────────────────────────────────────────────────────────────────
// Steel doorset — the state behind both layouts
// ─────────────────────────────────────────────────────────────────
// Guided and quick are two ways of asking the same questions, so the
// answers, the rules that keep them consistent, and the sheet they
// produce all live here. Both layouts read and write one session key,
// which is what lets someone switch between them mid-specification —
// and what saved projects read when they store the work.
// ─────────────────────────────────────────────────────────────────

export const STORAGE_KEY = "mf-steel-spec-v1";

export const initialConfig = () => ({
  fireRated: null,        // null until asked, then true/false
  minutes: null,
  leaves: null,
  highPerformance: false,
  exposure: "",
  frameId: "",
  width: "",
  height: "",
  handing: "left",
});

export const emptyProject = () => ({
  businessName: "", contactName: "", email: "", phone: "",
  projectName: "", architecturalFirm: "",
});

export const mmDigits = v => String(v).replace(/\D/g, "").slice(0, 4);

export function useSteelSpecState() {
  const [config, setConfig] = useState(initialConfig);
  const [specType, setSpecType] = useState("branded");
  const [projectData, setProjectData] = useState(emptyProject);
  const [currentStep, setCurrentStep] = useState(0);
  const [furthest, setFurthest] = useState(0);
  const [touched, setTouched] = useState(() => new Set());
  const [hydrated, setHydrated] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [notice, setNotice] = useState(null);

  // Restore before the first save runs, or the save writes an empty
  // configuration over the stored one.
  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.config) setConfig(c => ({ ...c, ...saved.config }));
        if (saved.projectData) setProjectData(pd => ({ ...pd, ...saved.projectData }));
        if (saved.specType) setSpecType(saved.specType);
        if (typeof saved.currentStep === "number") setCurrentStep(saved.currentStep);
        if (typeof saved.furthest === "number") setFurthest(saved.furthest);
      }
    } catch { /* corrupt or unavailable storage is not worth breaking the tool over */ }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
        config, specType, projectData, currentStep, furthest,
      }));
    } catch { /* best-effort */ }
  }, [hydrated, config, specType, projectData, currentStep, furthest]);

  const set = useCallback((key, value) => {
    setTouched(t => (t.has(key) ? t : new Set(t).add(key)));
    setConfig(c => ({ ...c, [key]: value }));
  }, []);

  const markTouched = useCallback(field => {
    setTouched(t => (t.has(field) ? t : new Set(t).add(field)));
  }, []);

  const resolution = resolveSteelDoor(config);
  const validation = withContactChecks(validateSteelDoor(config), projectData);

  // A change further up can invalidate what was chosen below it — drop
  // anything the new answers no longer offer, rather than carrying a
  // frame or exposure that does not exist for this doorset.
  const frameIds = resolution.frames.map(f => f.id).join(",");
  const exposureIds = resolution.exposures.map(e => e.id).join(",");
  useEffect(() => {
    if (config.frameId && frameIds && !frameIds.split(",").includes(config.frameId)) {
      setConfig(c => ({ ...c, frameId: "" }));
    }
    if (config.exposure && exposureIds && !exposureIds.split(",").includes(config.exposure)) {
      setConfig(c => ({ ...c, exposure: "" }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameIds, exposureIds]);

  // Where only one answer exists, give it rather than asking. An
  // internal-only doorset should say "Internal", not wait to be told.
  useEffect(() => {
    if (!config.exposure && resolution.exposures.length === 1) {
      setConfig(c => ({ ...c, exposure: resolution.exposures[0].id }));
    }
    if (!config.frameId && resolution.frames.length === 1) {
      setConfig(c => ({ ...c, frameId: resolution.frames[0].id }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exposureIds, frameIds, config.exposure, config.frameId]);

  // High Performance above 60 minutes does not exist; step back down
  // rather than leaving an impossible doorset selected.
  useEffect(() => {
    if (config.highPerformance && config.minutes != null && config.leaves
        && !highPerformanceAvailable({ minutes: config.minutes, leaves: config.leaves })) {
      setConfig(c => ({ ...c, highPerformance: false }));
    }
  }, [config.minutes, config.leaves, config.highPerformance]);

  const errorFor = useCallback(field => {
    if (!touched.has(field)) return null;
    return validation.errors.find(e => e.field === field)?.message ?? null;
  }, [touched, validation]);

  const startOver = useCallback(() => {
    setConfig(initialConfig());
    setProjectData(emptyProject());
    setSpecType("branded");
    setNotice(null);
    setTouched(new Set());
    setCurrentStep(0);
    setFurthest(0);
    try { window.sessionStorage.removeItem(STORAGE_KEY); } catch { /* best-effort */ }
  }, []);

  const generate = useCallback(async () => {
    if (!validation.isValid) return;
    setGenerating(true);
    setNotice(null);
    try {
      const filename = await generateSteelDoorPDF({ config, projectData, specType, resolution });
      setNotice({ text: `Saved ${filename}` });
    } catch (err) {
      setNotice({ error: true, text: err?.message || "The PDF could not be generated." });
    } finally {
      setGenerating(false);
    }
  }, [validation.isValid, config, projectData, specType, resolution]);

  return {
    config, set, setConfig,
    specType, setSpecType,
    projectData, setProjectData,
    currentStep, setCurrentStep, furthest, setFurthest,
    markTouched, errorFor,
    resolution, validation,
    hydrated, generating, notice,
    startOver, generate,
  };
}

/** The enquiry fields are the tool's own, not the doorset's — checked
 *  here and folded into the same list so one count covers both. */
function withContactChecks(validation, projectData) {
  const errors = [...validation.errors];
  const pd = projectData ?? {};

  if (REQUIRE_ENQUIRY_DETAILS && !pd.businessName?.trim()) {
    errors.push({ field: "businessName", message: "Enter your business name." });
  }
  if (REQUIRE_ENQUIRY_DETAILS && !pd.email?.trim()) {
    errors.push({ field: "email", message: "Enter an email address." });
  } else if (pd.email?.trim() && !isEmail(pd.email)) {
    errors.push({ field: "email", message: "That email address does not look right." });
  }
  if (REQUIRE_ENQUIRY_DETAILS && !pd.phone?.trim()) {
    errors.push({ field: "phone", message: "Enter a phone number." });
  } else if (pd.phone?.trim() && !isPhone(pd.phone)) {
    errors.push({ field: "phone", message: "That phone number does not look right." });
  }

  return { ...validation, errors, isValid: errors.length === 0 };
}
