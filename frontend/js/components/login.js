function createLoginForm(storeId) {
  const form = document.createElement("form");
  form.className = "login-form";
  form.onsubmit = (e) => handleLogin(e, storeId);

  const passwordGroup = document.createElement("div");
  passwordGroup.className = "mb-3";
  passwordGroup.style.width = "100%";

  const passwordLabel = document.createElement("label");
  passwordLabel.htmlFor = "password";
  passwordLabel.textContent = "Store Password";
  passwordLabel.className = "form-label mb-2";
  passwordLabel.style.fontSize = "14px";

  const passwordContainer = document.createElement("div");
  passwordContainer.style.position = "relative";
  passwordContainer.style.width = "100%";
  passwordContainer.style.maxWidth = "100%";
  
  const passwordInput = document.createElement("input");
  passwordInput.type = "password";
  passwordInput.id = "password";
  passwordInput.name = "password";
  passwordInput.className = "form-control";
  passwordInput.required = true;
  passwordInput.placeholder = "Enter the store password";
  passwordInput.autocomplete = "current-password";
  passwordInput.style.paddingRight = "35px";
  passwordInput.style.width = "100%";
  passwordInput.style.maxWidth = "100%";
  passwordInput.style.boxSizing = "border-box";
  
  const eyeIcon = document.createElement("button");
  eyeIcon.type = "button";
  eyeIcon.innerHTML = "👁";
  eyeIcon.style.position = "absolute";
  eyeIcon.style.right = "8px";
  eyeIcon.style.top = "50%";
  eyeIcon.style.transform = "translateY(-50%)";
  eyeIcon.style.border = "none";
  eyeIcon.style.background = "none";
  eyeIcon.style.cursor = "pointer";
  eyeIcon.style.fontSize = "16px";
  eyeIcon.title = "Show/hide password";
  
  eyeIcon.addEventListener('click', () => {
    if (passwordInput.type === 'password') {
      passwordInput.type = 'text';
      eyeIcon.innerHTML = '🙈';
    } else {
      passwordInput.type = 'password';
      eyeIcon.innerHTML = '👁';
    }
  });
  
  passwordContainer.appendChild(passwordInput);
  passwordContainer.appendChild(eyeIcon);

  passwordGroup.appendChild(passwordLabel);
  passwordGroup.appendChild(passwordContainer);

  const rememberGroup = document.createElement("div");
  rememberGroup.className = "mb-2";
  rememberGroup.style.display = "flex";
  rememberGroup.style.alignItems = "center";
  rememberGroup.style.justifyContent = "center";
  rememberGroup.style.width = "100%";

  const checkboxContainer = document.createElement("div");
  checkboxContainer.style.display = "flex";
  checkboxContainer.style.alignItems = "center";
  checkboxContainer.style.gap = "6px";

  const rememberCheck = document.createElement("input");
  rememberCheck.type = "checkbox";
  rememberCheck.id = "remember-me";
  rememberCheck.name = "remember";
  rememberCheck.style.margin = "0";

  const rememberLabel = document.createElement("label");
  rememberLabel.htmlFor = "remember-me";
  rememberLabel.textContent = "Remember me";
  rememberLabel.style.fontSize = "14px";
  rememberLabel.style.margin = "0";
  rememberLabel.style.cursor = "pointer";
  rememberLabel.style.userSelect = "none";
  rememberLabel.style.whiteSpace = "nowrap";

  checkboxContainer.appendChild(rememberCheck);
  checkboxContainer.appendChild(rememberLabel);
  rememberGroup.appendChild(checkboxContainer);

  // Create submit button
  const submitButton = document.createElement("button");
  submitButton.type = "submit";
  submitButton.className = "btn btn-primary w-100 mt-2";
  submitButton.textContent = "Login";
  submitButton.style.fontSize = "14px";

  // Create error message container
  const statusMessage = document.createElement("div");
  statusMessage.className = "mt-2 p-2 rounded text-center";
  statusMessage.style.display = "none";
  statusMessage.style.fontSize = "13px";

  // Add all elements to form
  form.appendChild(passwordGroup);
  form.appendChild(rememberGroup);
  form.appendChild(submitButton);
  form.appendChild(statusMessage);

  return form;
}

async function handleLogin(event, storeId) {
  event.preventDefault();

  const form = event.target;
  const password = form.password.value;
  const rememberMe = form.remember?.checked || false;
  const statusMessage = form.querySelector(".mt-2.p-2.rounded");
  const submitButton = form.querySelector('button[type="submit"]');

  // Validate input
  if (!password || password.trim() === "") {
    statusMessage.textContent = "Please enter a password";
    statusMessage.className = "mt-3 p-2 rounded text-center bg-warning";
    statusMessage.style.display = "block";
    return;
  }

  // Disable form during submission
  submitButton.disabled = true;
  submitButton.textContent = "Logging in...";
  statusMessage.style.display = "none";

  try {
    // Call login API directly
    const response = await fetch(`/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        store_id: storeId,
        pin: password
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || "Login failed");
    }

    // Store the token
    if (typeof AuthManager !== "undefined") {
      AuthManager.setToken(storeId, data.token);
      AuthManager.setCurrentStoreId(storeId);
    } else {
      localStorage.setItem(`store_${storeId}_token`, data.token);
      localStorage.setItem('current_store_id', storeId);
    }

    // Show success message before redirect
    statusMessage.textContent = "Login successful. Redirecting...";
    statusMessage.className =
      "mt-3 p-2 rounded text-center bg-success text-white";
    statusMessage.style.display = "block";

    // Wait a moment to show the success message, then redirect
    setTimeout(() => {
      window.location.href = `/prices`;
    }, 500);
  } catch (error) {
    statusMessage.textContent =
      error.message || "An error occurred during login";
    statusMessage.className =
      "mt-3 p-2 rounded text-center bg-danger text-white";
    statusMessage.style.display = "block";

    // Re-enable form
    submitButton.disabled = false;
    submitButton.textContent = "Login";
  }
}

function initLoginForm(containerId, storeId) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`Container with ID ${containerId} not found`);
    return;
  }

  container.innerHTML = "";

  container.appendChild(createLoginForm(storeId));
}

window.initLoginForm = initLoginForm;
window.createLoginForm = createLoginForm;
