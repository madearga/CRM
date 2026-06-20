// Metro "before main" polyfills.
//
// This file is injected by metro.config.js via
// `serializer.getModulesRunBeforeMainModule`, so it runs before Expo's own
// runtime polyfills (not just before app code). SDK 54's Expo Go loads
// `webidl-conversions` while initializing URL/manifest helpers, and that
// package dereferences `SharedArrayBuffer` at module scope. Hermes in Expo Go
// does not define it, so app-level polyfills are too late.

if (typeof globalThis.SharedArrayBuffer === "undefined") {
  globalThis.SharedArrayBuffer = ArrayBuffer;
}

// Some `webidl-conversions` versions also read resizable/growable ArrayBuffer
// prototype getters at module scope. Hermes may not expose these proposal
// properties; provide false-y getters so feature detection can proceed.
function defineFalseGetter(target, property) {
  if (!target || Object.prototype.hasOwnProperty.call(target, property)) {
    return;
  }

  Object.defineProperty(target, property, {
    configurable: true,
    get() {
      return false;
    },
  });
}

defineFalseGetter(ArrayBuffer.prototype, "resizable");
defineFalseGetter(ArrayBuffer.prototype, "growable");
defineFalseGetter(globalThis.SharedArrayBuffer.prototype, "resizable");
defineFalseGetter(globalThis.SharedArrayBuffer.prototype, "growable");

// `webidl-conversions@8` calls String.prototype.toWellFormed(), which is part
// of newer JS runtimes but not available in the Hermes version bundled with
// current Expo Go. Minimal well-formed Unicode conversion: replace lone
// surrogate code units with U+FFFD, preserve valid surrogate pairs.
if (typeof String.prototype.toWellFormed !== "function") {
  Object.defineProperty(String.prototype, "toWellFormed", {
    configurable: true,
    writable: true,
    value() {
      const input = String(this);
      let output = "";
      for (let index = 0; index < input.length; index += 1) {
        const code = input.charCodeAt(index);

        if (code >= 0xd800 && code <= 0xdbff) {
          const next = input.charCodeAt(index + 1);
          if (next >= 0xdc00 && next <= 0xdfff) {
            output += input[index] + input[index + 1];
            index += 1;
          } else {
            output += "\uFFFD";
          }
        } else if (code >= 0xdc00 && code <= 0xdfff) {
          output += "\uFFFD";
        } else {
          output += input[index];
        }
      }
      return output;
    },
  });
}

if (typeof String.prototype.isWellFormed !== "function") {
  Object.defineProperty(String.prototype, "isWellFormed", {
    configurable: true,
    writable: true,
    value() {
      return String(this).toWellFormed() === String(this);
    },
  });
}
