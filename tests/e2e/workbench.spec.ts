import { expect, test, type Page } from "@playwright/test";
import JSZip from "jszip";

async function openPackage(page: Page) {
  await page.goto("/");
  await page.getByRole("tab", { name: /Clasp package & handoff/ }).click();
}
async function noPageOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    page: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(dimensions.page).toBeLessThanOrEqual(dimensions.viewport);
  expect(dimensions.body).toBeLessThanOrEqual(dimensions.viewport);
}

test("375px command bar, four views, and horizontally scrollable sheet stay inside the page", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await noPageOverflow(page);
  const header = await page.locator(".command-bar").boundingBox();
  expect(header!.x + header!.width).toBeLessThanOrEqual(375);
  for (const name of [
    "Load Sample Data",
    "Run Trigger",
    "Run Again (Idempotency)",
  ]) {
    const button = await page
      .getByRole("button", { name, exact: true })
      .boundingBox();
    expect(button!.x).toBeGreaterThanOrEqual(0);
    expect(button!.x + button!.width).toBeLessThanOrEqual(375);
  }
  await page
    .getByRole("button", { name: "Load Sample Data", exact: true })
    .click();
  await page.getByRole("button", { name: "Run Trigger", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Run Trigger", exact: true }),
  ).toBeEnabled();
  await expect(page.locator(".sheet-table tbody tr")).toHaveCount(4);
  const scroll = page.locator(".table-scroll");
  expect(await scroll.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(
    true,
  );
  await scroll.evaluate((el) => {
    el.scrollLeft = el.scrollWidth;
  });
  await expect(
    page.getByRole("columnheader", { name: "id", exact: true }),
  ).toBeVisible();
  expect(
    await page
      .getByRole("columnheader", { name: "id", exact: true })
      .evaluate((el) => getComputedStyle(el).position),
  ).toBe("sticky");
  await noPageOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath("sheet-375.png"),
    fullPage: true,
  });
  for (const label of [
    "Discovery & tool overlap",
    "Live sheet & quarantine",
    "Gmail drafts & weekly ops",
    "Clasp package & handoff",
  ]) {
    await page.getByRole("tab", { name: new RegExp(label) }).click();
    await noPageOverflow(page);
  }
  await page.screenshot({
    path: testInfo.outputPath("package-375.png"),
    fullPage: true,
  });
});

test("sample trigger, row trace, quarantine, repeat-run, and approval counters", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Load Sample Data", exact: true })
    .click();
  await page.getByRole("button", { name: "Run Trigger", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Run Trigger", exact: true }),
  ).toBeEnabled();
  await expect(page.locator(".sheet-table tbody tr")).toHaveCount(4);
  await page
    .getByRole("button", { name: "Inspect trace Q-1041", exact: true })
    .click();
  await expect(page.getByLabel("Recorded events for Q-1041")).toContainText(
    "DFT-1041",
  );
  await page
    .getByRole("tab", { name: "Quarantine / Bad Rows 1", exact: true })
    .click();
  await expect(
    page.getByRole("tabpanel", { name: "Quarantined rows", exact: true }),
  ).toContainText("Missing or invalid customer contact");
  await expect(
    page.getByRole("tabpanel", { name: "Quarantined rows", exact: true }),
  ).toContainText("Invalid due_on");
  await page
    .getByRole("button", { name: "Run Again (Idempotency)", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Run Trigger", exact: true }),
  ).toBeEnabled();
  await expect(page.locator(".view-toolbar")).toContainText(
    "5 duplicates blocked",
  );
  await expect(page.locator(".quarantine-card")).toHaveCount(1);
  await page.getByRole("tab", { name: /Gmail drafts & weekly ops/ }).click();
  await expect(
    page
      .getByRole("navigation", { name: "Customer drafts" })
      .getByRole("button"),
  ).toHaveCount(4);
  await page
    .getByRole("button", { name: "Approve & Simulate Send", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm simulated send", exact: true })
    .click();
  await expect(page.locator(".ops-metrics")).toContainText("4 / 1");
});

test("native clipboard writes all four exact files and resets Copied on file changes", async ({
  page,
  context,
  browserName,
}) => {
  test.skip(
    browserName !== "chromium",
    "Native clipboard permission automation is Chromium-specific; fallback paths run in every engine.",
  );
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await openPackage(page);
  for (const name of [
    "Code.gs",
    "appsscript.json",
    "CLAUDE.md",
    "HANDOFF.md",
  ]) {
    await page.getByRole("tab", { name, exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Copy File", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Copy File", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Copied", exact: true }),
    ).toBeVisible();
    const value = await page.evaluate(() => navigator.clipboard.readText());
    expect(value.length).toBeGreaterThan(100);
    if (name === "appsscript.json")
      expect(JSON.parse(value).oauthScopes).toHaveLength(5);
    if (name === "Code.gs")
      expect(value).toContain("Gmail.Users.Drafts.create");
  }
});

test("clipboard rejection uses textarea execCommand fallback and removes the temporary field", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error("Denied")) },
    });
    const original = document.execCommand.bind(document);
    document.execCommand = (command: string) => {
      if (command === "copy")
        document.documentElement.dataset.copyFallback = "attempted";
      return original(command);
    };
  });
  await openPackage(page);
  await page.getByRole("button", { name: "Copy File", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Copied", exact: true }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute(
    "data-copy-fallback",
    "attempted",
  );
  await expect(
    page.getByLabel("Copy generated file", { exact: true }),
  ).toHaveCount(0);
});

test("blocked clipboard never falsely reports Copied and exposes selected manual text", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error("Denied")) },
    });
    document.execCommand = () => false;
  });
  await openPackage(page);
  await page.getByRole("button", { name: "Copy File", exact: true }).click();
  const field = page.getByRole("textbox", {
    name: "Manual file copy",
    exact: true,
  });
  await expect(field).toBeVisible();
  await expect(field).toBeFocused();
  expect(
    await field.evaluate(
      (el: HTMLTextAreaElement) => el.selectionEnd - el.selectionStart,
    ),
  ).toBeGreaterThan(100);
  await expect(
    page.getByRole("button", { name: "Copied", exact: true }),
  ).toHaveCount(0);
});

test("stalled modern clipboard times out into the manual fallback", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: () => new Promise(() => {}) },
    });
    document.execCommand = () => false;
  });
  await openPackage(page);
  await page.getByRole("button", { name: "Copy File", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Manual file copy", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Copy File", exact: true }),
  ).toBeEnabled();
});

test("custom client at 375px generates and downloads the correct five-file ZIP", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await page
    .getByLabel("Environment switcher", { exact: true })
    .selectOption("custom");
  await page
    .getByRole("textbox", { name: /^Company type/ })
    .fill("HVAC & Plumbing Contractor");
  await page
    .getByRole("textbox", { name: /^Tools they pay for/ })
    .fill("Jobber, Typeform, DocuSign");
  await page
    .getByRole("textbox", {
      name: "The sheet someone updates by hand",
      exact: true,
    })
    .fill("Weekly Open Quotes & Dispatch Tracker");
  await page.getByLabel(/^Workspace edition/).selectOption("Business Plus");
  await page
    .getByRole("button", {
      name: "Generate Custom Workspace Package",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "HVAC & Plumbing Contractor",
      exact: true,
    }),
  ).toBeVisible();
  await noPageOverflow(page);
  await page.getByRole("tab", { name: "appsscript.json", exact: true }).click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page
      .getByRole("button", {
        name: "Download Full Clasp Bundle (.zip)",
        exact: true,
      })
      .click(),
  ]);
  expect(download.suggestedFilename()).toBe(
    "hvac_plumbing_contractor-workspace-clasp.zip",
  );
  const path = testInfo.outputPath(download.suggestedFilename());
  await download.saveAs(path);
  const fs = await import("node:fs/promises");
  const zip = await JSZip.loadAsync(await fs.readFile(path));
  expect(Object.keys(zip.files).sort()).toEqual(
    [
      ".claspignore",
      "CLAUDE.md",
      "Code.gs",
      "HANDOFF.md",
      "appsscript.json",
    ].sort(),
  );
  expect(await zip.file("Code.gs")!.async("string")).toContain(
    "HVAC_PLUMBING_CONTRACTOR",
  );
  expect(
    JSON.parse(await zip.file("appsscript.json")!.async("string")).oauthScopes,
  ).toHaveLength(5);
});
