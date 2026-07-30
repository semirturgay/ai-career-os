const apiInput = document.getElementById("api-base-url");
const appInput = document.getElementById("app-base-url");
const saveBtn = document.getElementById("save-btn");
const savedEl = document.getElementById("saved");

async function load() {
  const settings = await getExtensionSettings();
  apiInput.value = settings.apiBaseUrl;
  appInput.value = settings.appBaseUrl;
}

saveBtn.addEventListener("click", async () => {
  await saveExtensionSettings({
    apiBaseUrl: apiInput.value.trim(),
    appBaseUrl: appInput.value.trim(),
  });
  savedEl.textContent = "Saved.";
  setTimeout(() => {
    savedEl.textContent = "";
  }, 2000);
});

load();
