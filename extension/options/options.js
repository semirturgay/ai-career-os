const apiInput = document.getElementById("api-base-url");
const saveBtn = document.getElementById("save-btn");
const savedEl = document.getElementById("saved");

async function load() {
  const settings = await getExtensionSettings();
  apiInput.value = settings.apiBaseUrl;
}

saveBtn.addEventListener("click", async () => {
  await saveExtensionSettings({
    apiBaseUrl: apiInput.value.trim(),
  });
  savedEl.textContent = "Saved.";
  setTimeout(() => {
    savedEl.textContent = "";
  }, 2000);
});

load();
