/**
 * Security Utilities Module
 *
 * Provides security-related utilities for the Moltbot wrapper:
 * - CogSec pattern detection (prompt injection, exfiltration attempts)
 * - Audit logging
 * - Security validation helpers
 */

import fs from "node:fs";
import path from "node:path";

// =============================================================================
// Audit Logging
// =============================================================================

const AUDIT_LOG_DIR = process.env.MOLTBOT_STATE_DIR?.trim() || "/data/.moltbot";
const AUDIT_LOG_FILE = path.join(AUDIT_LOG_DIR, "audit.log");

/**
 * Log a security-relevant event
 */
export function auditLog(event) {
  const entry = {
    timestamp: new Date().toISOString(),
    ...event,
  };

  const line = JSON.stringify(entry) + "\n";

  try {
    fs.mkdirSync(AUDIT_LOG_DIR, { recursive: true });
    fs.appendFileSync(AUDIT_LOG_FILE, line);
  } catch (err) {
    console.error("[audit] Failed to write:", err.message);
  }

  // Also log to console for Railway logs
  if (event.severity === "high" || event.severity === "critical") {
    console.warn(`[SECURITY] ${event.type}: ${event.message}`);
  }
}

/**
 * Log an authentication event
 */
export function auditAuth(success, details = {}) {
  auditLog({
    type: "auth",
    success,
    severity: success ? "info" : "medium",
    message: success ? "Authentication successful" : "Authentication failed",
    ...details,
  });
}

/**
 * Log a configuration change
 */
export function auditConfigChange(key, oldValue, newValue, user = "system") {
  auditLog({
    type: "config_change",
    severity: "info",
    message: `Config changed: ${key}`,
    key,
    oldValue: typeof oldValue === "string" && oldValue.length > 50 ? "(redacted)" : oldValue,
    newValue: typeof newValue === "string" && newValue.length > 50 ? "(redacted)" : newValue,
    user,
  });
}

// =============================================================================
// CogSec Pattern Detection
// =============================================================================

const INJECTION_PATTERNS = [
  // System prompt override attempts
  /ignore (all |previous |prior )?instructions/i,
  /disregard (all |previous |prior )?instructions/i,
  /forget (all |previous |prior )?instructions/i,
  /new (system )?prompt:/i,
  /system:\s*you are/i,
  /\[system\]/i,
  /\[INST\]/i,
  /<<SYS>>/i,

  // Jailbreak attempts
  /DAN mode/i,
  /developer mode/i,
  /evil mode/i,
  /unrestricted mode/i,
  /no restrictions/i,
  /bypass (all |your )?filters/i,

  // Role manipulation
  /pretend (you are|to be|you're)/i,
  /act as if/i,
  /roleplay as/i,
  /you are now/i,

  // Hidden instruction markers
  /\[hidden\]/i,
  /\[secret\]/i,
  /\[admin\]/i,
  /<!--.*-->/s,
];

const EXFILTRATION_PATTERNS = [
  // Direct exfiltration
  /send (to|this to) (http|https|ftp)/i,
  /upload (to|this to)/i,
  /post (to|this to) (url|endpoint|server)/i,
  /exfiltrate/i,
  /leak (the |this |my )?data/i,

  // Credential extraction
  /what('s| is) (the |your )?(api |secret |private )?key/i,
  /show me (the |your )?(token|credentials|password)/i,
  /print (the |your )?(env|environment|config)/i,

  // System probing
  /what system are you running/i,
  /what('s| is) your (ip|address|location)/i,
  /list (all )?(files|directories|env)/i,
];

/**
 * Check text for prompt injection patterns
 * Returns { detected: boolean, patterns: string[], severity: string }
 */
export function detectInjection(text) {
  if (!text || typeof text !== "string") {
    return { detected: false, patterns: [], severity: "none" };
  }

  const detected = [];

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      detected.push(pattern.source);
    }
  }

  if (detected.length === 0) {
    return { detected: false, patterns: [], severity: "none" };
  }

  // Severity based on number of patterns matched
  const severity = detected.length >= 3 ? "high" : detected.length >= 2 ? "medium" : "low";

  return { detected: true, patterns: detected, severity };
}

/**
 * Check text for data exfiltration patterns
 */
export function detectExfiltration(text) {
  if (!text || typeof text !== "string") {
    return { detected: false, patterns: [], severity: "none" };
  }

  const detected = [];

  for (const pattern of EXFILTRATION_PATTERNS) {
    if (pattern.test(text)) {
      detected.push(pattern.source);
    }
  }

  if (detected.length === 0) {
    return { detected: false, patterns: [], severity: "none" };
  }

  const severity = detected.length >= 2 ? "high" : "medium";

  return { detected: true, patterns: detected, severity };
}

/**
 * Run full CogSec analysis on text
 */
export function analyzeCogSec(text, context = {}) {
  const injection = detectInjection(text);
  const exfiltration = detectExfiltration(text);

  const result = {
    injection,
    exfiltration,
    safe: !injection.detected && !exfiltration.detected,
    overallSeverity: "none",
  };

  // Determine overall severity
  if (injection.severity === "high" || exfiltration.severity === "high") {
    result.overallSeverity = "high";
  } else if (injection.severity === "medium" || exfiltration.severity === "medium") {
    result.overallSeverity = "medium";
  } else if (injection.detected || exfiltration.detected) {
    result.overallSeverity = "low";
  }

  // Log if detection occurred
  if (!result.safe) {
    auditLog({
      type: "cogsec_detection",
      severity: result.overallSeverity,
      message: "Potential security pattern detected",
      injection: injection.detected,
      exfiltration: exfiltration.detected,
      patterns: [...injection.patterns, ...exfiltration.patterns],
      ...context,
    });
  }

  return result;
}

// =============================================================================
// Security Validation Helpers
// =============================================================================

/**
 * Validate that a password meets minimum requirements
 */
export function validatePassword(password) {
  const issues = [];

  if (!password) {
    issues.push("Password is required");
    return { valid: false, issues };
  }

  if (password.length < 16) {
    issues.push("Password must be at least 16 characters");
  }

  if (password.length > 256) {
    issues.push("Password must be less than 256 characters");
  }

  // Check for common weak patterns
  if (/^(.)\1+$/.test(password)) {
    issues.push("Password cannot be all the same character");
  }

  if (/^(12345|password|admin|qwerty)/i.test(password)) {
    issues.push("Password is too common");
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

/**
 * Validate a gateway token format
 */
export function validateGatewayToken(token) {
  if (!token) {
    return { valid: false, reason: "Token is required" };
  }

  if (typeof token !== "string") {
    return { valid: false, reason: "Token must be a string" };
  }

  if (token.length < 32) {
    return { valid: false, reason: "Token must be at least 32 characters" };
  }

  if (!/^[a-f0-9]+$/i.test(token)) {
    return { valid: false, reason: "Token must be hexadecimal" };
  }

  return { valid: true };
}

/**
 * Sanitize user input for logging (remove sensitive data patterns)
 */
export function sanitizeForLog(text) {
  if (!text || typeof text !== "string") return text;

  return text
    // Remove potential tokens/keys
    .replace(/[a-zA-Z0-9_-]{32,}/g, "[REDACTED]")
    // Remove email-like patterns
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[EMAIL]")
    // Remove URL credentials
    .replace(/:\/\/[^:]+:[^@]+@/g, "://[CREDS]@")
    // Truncate if too long
    .slice(0, 500);
}

export default {
  auditLog,
  auditAuth,
  auditConfigChange,
  detectInjection,
  detectExfiltration,
  analyzeCogSec,
  validatePassword,
  validateGatewayToken,
  sanitizeForLog,
};
