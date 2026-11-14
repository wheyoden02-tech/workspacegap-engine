/** Copy when the browser allows it; never report success without an API acknowledgement. */
export async function copyText(text: string): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    if (navigator.clipboard?.writeText) {
      await Promise.race([
        navigator.clipboard.writeText(text),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error("Clipboard did not respond")),
            1500,
          );
        }),
      ]);
      return true;
    }
  } catch {
    // Permission denial, insecure contexts, or stalled APIs use the selection fallback.
  } finally {
    clearTimeout(timer);
  }

  const field = document.createElement("textarea");
  const previousFocus = document.activeElement as HTMLElement | null;
  field.value = text;
  field.readOnly = true;
  field.tabIndex = -1;
  field.setAttribute("aria-label", "Copy generated file");
  Object.assign(field.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: "1px",
    height: "1px",
    opacity: "0",
    fontSize: "16px",
  });
  try {
    document.body.appendChild(field);
    field.focus({ preventScroll: true });
    field.select();
    field.setSelectionRange(0, text.length);
    return (
      typeof document.execCommand === "function" && document.execCommand("copy")
    );
  } catch {
    return false;
  } finally {
    field.remove();
    try {
      previousFocus?.focus({ preventScroll: true });
    } catch {
      /* focus restoration must not change the copy result */
    }
  }
}
