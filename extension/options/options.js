const apiInput = document.getElementById("api-base-url");
const tokenInput = document.getElementById("api-token");
const saveBtn = document.getElementById("save-btn");
const savedEl = document.getElementById("saved");

async function load() {
  const settings = await getExtensionSettings();
  apiInput.value = settings.apiBaseUrl;
  tokenInput.value = settings.apiToken;
}

saveBtn.addEventListener("click", async () => {
  await saveExtensionSettings({
    apiBaseUrl: apiInput.value.trim(),
    apiToken: tokenInput.value,
  });
  savedEl.textContent = "Saved.";
  setTimeout(() => {
    savedEl.textContent = "";
  }, 2000);
});

load();
