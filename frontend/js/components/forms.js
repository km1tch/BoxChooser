/**
 * Form components for user input
 * 
 * Provides reusable form elements with validation and formatting
 */

/**
 * Creates a number input field with validation
 * @param {Object} config - Input configuration
 * @returns {HTMLElement} - The input element
 */
function createNumberInput(config) {
  const {
    id,
    label,
    min,
    max,
    step = 1,
    value = '',
    placeholder = '',
    required = false,
    onChange,
    onValidate
  } = config;
  
  const container = document.createElement('div');
  container.className = 'form-field';
  
  if (label) {
    const labelElement = document.createElement('label');
    labelElement.setAttribute('for', id);
    labelElement.textContent = label;
    if (required) {
      labelElement.classList.add('required');
    }
    container.appendChild(labelElement);
  }
  
  const input = document.createElement('input');
  input.type = 'number';
  input.id = id;
  input.name = id;
  input.placeholder = placeholder;
  input.value = value;
  
  if (min !== undefined) input.min = min;
  if (max !== undefined) input.max = max;
  if (step !== undefined) input.step = step;
  if (required) input.required = true;
  
  // Create error message container
  const errorContainer = document.createElement('div');
  errorContainer.className = 'form-field-error';
  errorContainer.style.display = 'none';
  
  // Validation function
  function validate() {
    const value = input.value.trim();
    const numberValue = parseFloat(value);
    
    // Clear previous errors
    errorContainer.style.display = 'none';
    errorContainer.textContent = '';
    input.classList.remove('error');
    
    // Required validation
    if (required && value === '') {
      errorContainer.textContent = 'This field is required';
      errorContainer.style.display = 'block';
      input.classList.add('error');
      return false;
    }
    
    // Validate it's a number
    if (value !== '' && isNaN(numberValue)) {
      errorContainer.textContent = 'Please enter a valid number';
      errorContainer.style.display = 'block';
      input.classList.add('error');
      return false;
    }
    
    // Min/max validation
    if (value !== '') {
      if (min !== undefined && numberValue < min) {
        errorContainer.textContent = `Minimum value is ${min}`;
        errorContainer.style.display = 'block';
        input.classList.add('error');
        return false;
      }
      
      if (max !== undefined && numberValue > max) {
        errorContainer.textContent = `Maximum value is ${max}`;
        errorContainer.style.display = 'block';
        input.classList.add('error');
        return false;
      }
    }
    
    // Custom validation
    if (onValidate) {
      const customError = onValidate(numberValue);
      if (customError) {
        errorContainer.textContent = customError;
        errorContainer.style.display = 'block';
        input.classList.add('error');
        return false;
      }
    }
    
    return true;
  }
  
  // Setup event handlers
  input.addEventListener('input', function() {
    validate();
    if (onChange) {
      onChange(parseFloat(this.value), this);
    }
  });
  
  input.addEventListener('blur', function() {
    validate();
  });
  
  // Add to container
  container.appendChild(input);
  container.appendChild(errorContainer);
  
  // Add validation method to the container
  container.validate = validate;
  
  // Add method to get the input value
  container.getValue = function() {
    const value = input.value.trim();
    return value === '' ? null : parseFloat(value);
  };
  
  // Add method to set the input value
  container.setValue = function(newValue) {
    input.value = newValue !== null && newValue !== undefined ? newValue : '';
    validate();
  };
  
  return container;
}

/**
 * Creates a text input field with validation
 * @param {Object} config - Input configuration
 * @returns {HTMLElement} - The input element
 */
function createTextInput(config) {
  const {
    id,
    label,
    type = 'text',
    value = '',
    placeholder = '',
    required = false,
    minLength,
    maxLength,
    pattern,
    onChange,
    onValidate
  } = config;
  
  const container = document.createElement('div');
  container.className = 'form-field';
  
  if (label) {
    const labelElement = document.createElement('label');
    labelElement.setAttribute('for', id);
    labelElement.textContent = label;
    if (required) {
      labelElement.classList.add('required');
    }
    container.appendChild(labelElement);
  }
  
  const input = document.createElement('input');
  input.type = type;
  input.id = id;
  input.name = id;
  input.placeholder = placeholder;
  input.value = value;
  
  if (required) input.required = true;
  if (minLength !== undefined) input.minLength = minLength;
  if (maxLength !== undefined) input.maxLength = maxLength;
  if (pattern) input.pattern = pattern;
  
  // Create error message container
  const errorContainer = document.createElement('div');
  errorContainer.className = 'form-field-error';
  errorContainer.style.display = 'none';
  
  // Validation function
  function validate() {
    const value = input.value.trim();
    
    // Clear previous errors
    errorContainer.style.display = 'none';
    errorContainer.textContent = '';
    input.classList.remove('error');
    
    // Required validation
    if (required && value === '') {
      errorContainer.textContent = 'This field is required';
      errorContainer.style.display = 'block';
      input.classList.add('error');
      return false;
    }
    
    // Min length validation
    if (minLength !== undefined && value !== '' && value.length < minLength) {
      errorContainer.textContent = `Minimum length is ${minLength} characters`;
      errorContainer.style.display = 'block';
      input.classList.add('error');
      return false;
    }
    
    // Max length validation
    if (maxLength !== undefined && value.length > maxLength) {
      errorContainer.textContent = `Maximum length is ${maxLength} characters`;
      errorContainer.style.display = 'block';
      input.classList.add('error');
      return false;
    }
    
    // Pattern validation
    if (pattern && value !== '' && !new RegExp(pattern).test(value)) {
      errorContainer.textContent = 'Please enter a valid format';
      errorContainer.style.display = 'block';
      input.classList.add('error');
      return false;
    }
    
    // Custom validation
    if (onValidate) {
      const customError = onValidate(value);
      if (customError) {
        errorContainer.textContent = customError;
        errorContainer.style.display = 'block';
        input.classList.add('error');
        return false;
      }
    }
    
    return true;
  }
  
  // Setup event handlers
  input.addEventListener('input', function() {
    validate();
    if (onChange) {
      onChange(this.value, this);
    }
  });
  
  input.addEventListener('blur', function() {
    validate();
  });
  
  // Add to container
  container.appendChild(input);
  container.appendChild(errorContainer);
  
  // Add validation method to the container
  container.validate = validate;
  
  // Add method to get the input value
  container.getValue = function() {
    return input.value.trim();
  };
  
  // Add method to set the input value
  container.setValue = function(newValue) {
    input.value = newValue !== null && newValue !== undefined ? newValue : '';
    validate();
  };
  
  return container;
}

/**
 * Creates a select dropdown with options
 * @param {Object} config - Select configuration
 * @returns {HTMLElement} - The select element
 */
function createSelectInput(config) {
  const {
    id,
    label,
    options = [],
    value = '',
    placeholder = 'Select an option',
    required = false,
    onChange,
    onValidate
  } = config;
  
  const container = document.createElement('div');
  container.className = 'form-field';
  
  if (label) {
    const labelElement = document.createElement('label');
    labelElement.setAttribute('for', id);
    labelElement.textContent = label;
    if (required) {
      labelElement.classList.add('required');
    }
    container.appendChild(labelElement);
  }
  
  const select = document.createElement('select');
  select.id = id;
  select.name = id;
  
  if (required) select.required = true;
  
  // Add placeholder option
  if (placeholder) {
    const placeholderOption = document.createElement('option');
    placeholderOption.value = '';
    placeholderOption.textContent = placeholder;
    placeholderOption.disabled = true;
    placeholderOption.selected = !value;
    select.appendChild(placeholderOption);
  }
  
  // Add options
  options.forEach(option => {
    const optionElement = document.createElement('option');
    
    if (typeof option === 'object') {
      optionElement.value = option.value;
      optionElement.textContent = option.label;
      if (option.value === value) {
        optionElement.selected = true;
      }
    } else {
      optionElement.value = option;
      optionElement.textContent = option;
      if (option === value) {
        optionElement.selected = true;
      }
    }
    
    select.appendChild(optionElement);
  });
  
  // Create error message container
  const errorContainer = document.createElement('div');
  errorContainer.className = 'form-field-error';
  errorContainer.style.display = 'none';
  
  // Validation function
  function validate() {
    const value = select.value;
    
    // Clear previous errors
    errorContainer.style.display = 'none';
    errorContainer.textContent = '';
    select.classList.remove('error');
    
    // Required validation
    if (required && value === '') {
      errorContainer.textContent = 'Please select an option';
      errorContainer.style.display = 'block';
      select.classList.add('error');
      return false;
    }
    
    // Custom validation
    if (onValidate) {
      const customError = onValidate(value);
      if (customError) {
        errorContainer.textContent = customError;
        errorContainer.style.display = 'block';
        select.classList.add('error');
        return false;
      }
    }
    
    return true;
  }
  
  // Setup event handlers
  select.addEventListener('change', function() {
    validate();
    if (onChange) {
      onChange(this.value, this);
    }
  });
  
  select.addEventListener('blur', function() {
    validate();
  });
  
  // Add to container
  container.appendChild(select);
  container.appendChild(errorContainer);
  
  // Add validation method to the container
  container.validate = validate;
  
  // Add method to get the select value
  container.getValue = function() {
    return select.value;
  };
  
  // Add method to set the select value
  container.setValue = function(newValue) {
    select.value = newValue !== null && newValue !== undefined ? newValue : '';
    validate();
  };
  
  return container;
}

/**
 * Creates a form with validation and submission handling
 * @param {Object} config - Form configuration
 * @returns {HTMLElement} - The form element
 */
function createForm(config) {
  const {
    id,
    fields = [],
    submitText = 'Submit',
    cancelText,
    onSubmit,
    onCancel
  } = config;
  
  const form = document.createElement('form');
  form.id = id;
  form.className = 'form';
  
  // Field containers for reference
  const fieldContainers = {};
  
  // Add fields
  fields.forEach(field => {
    let fieldContainer;
    
    switch (field.type) {
      case 'number':
        fieldContainer = createNumberInput(field);
        break;
      case 'select':
        fieldContainer = createSelectInput(field);
        break;
      default:
        fieldContainer = createTextInput(field);
        break;
    }
    
    form.appendChild(fieldContainer);
    fieldContainers[field.id] = fieldContainer;
  });
  
  // Create buttons container
  const buttonsContainer = document.createElement('div');
  buttonsContainer.className = 'form-buttons';
  
  // Submit button
  const submitButton = document.createElement('button');
  submitButton.type = 'submit';
  submitButton.textContent = submitText;
  submitButton.className = 'form-button submit-button';
  buttonsContainer.appendChild(submitButton);
  
  // Cancel button (optional)
  if (cancelText) {
    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.textContent = cancelText;
    cancelButton.className = 'form-button cancel-button';
    
    cancelButton.addEventListener('click', e => {
      e.preventDefault();
      if (onCancel) {
        onCancel();
      }
    });
    
    buttonsContainer.appendChild(cancelButton);
  }
  
  form.appendChild(buttonsContainer);
  
  // Form submission
  form.addEventListener('submit', e => {
    e.preventDefault();
    
    // Validate all fields
    let isValid = true;
    fields.forEach(field => {
      const fieldContainer = fieldContainers[field.id];
      if (fieldContainer && fieldContainer.validate) {
        if (!fieldContainer.validate()) {
          isValid = false;
        }
      }
    });
    
    if (!isValid) {
      return;
    }
    
    // Collect values
    const formValues = {};
    fields.forEach(field => {
      const fieldContainer = fieldContainers[field.id];
      if (fieldContainer && fieldContainer.getValue) {
        formValues[field.id] = fieldContainer.getValue();
      }
    });
    
    // Submit
    if (onSubmit) {
      onSubmit(formValues, form);
    }
  });
  
  // Add style if not already present
  const styleExists = document.getElementById('form-components-style');
  if (!styleExists) {
    const style = document.createElement('style');
    style.id = 'form-components-style';
    style.textContent = `
      .form {
        max-width: 600px;
        margin: 0 auto;
      }
      
      .form-field {
        margin-bottom: 20px;
      }
      
      .form-field label {
        display: block;
        margin-bottom: 5px;
        font-weight: 500;
      }
      
      .form-field label.required:after {
        content: '*';
        color: #dc3545;
        margin-left: 4px;
      }
      
      .form-field input,
      .form-field select {
        width: 100%;
        padding: 8px;
        border: 1px solid #ced4da;
        border-radius: 4px;
        font-size: 16px;
      }
      
      .form-field input:focus,
      .form-field select:focus {
        border-color: #86b7fe;
        outline: 0;
        box-shadow: 0 0 0 0.25rem rgba(13, 110, 253, 0.25);
      }
      
      .form-field input.error,
      .form-field select.error {
        border-color: #dc3545;
      }
      
      .form-field input.error:focus,
      .form-field select.error:focus {
        box-shadow: 0 0 0 0.25rem rgba(220, 53, 69, 0.25);
      }
      
      .form-field-error {
        color: #dc3545;
        font-size: 14px;
        margin-top: 5px;
      }
      
      .form-buttons {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        margin-top: 30px;
      }
      
      .form-button {
        padding: 8px 16px;
        border: none;
        border-radius: 4px;
        font-size: 16px;
        cursor: pointer;
      }
      
      .submit-button {
        background-color: #0d6efd;
        color: white;
      }
      
      .submit-button:hover {
        background-color: #0b5ed7;
      }
      
      .cancel-button {
        background-color: #6c757d;
        color: white;
      }
      
      .cancel-button:hover {
        background-color: #5a6268;
      }
    `;
    document.head.appendChild(style);
  }
  
  // Add methods to the form
  
  // Set all form values
  form.setValues = function(values) {
    if (!values) return;
    
    Object.entries(values).forEach(([key, value]) => {
      if (fieldContainers[key] && fieldContainers[key].setValue) {
        fieldContainers[key].setValue(value);
      }
    });
  };
  
  // Get all form values
  form.getValues = function() {
    const values = {};
    fields.forEach(field => {
      const fieldContainer = fieldContainers[field.id];
      if (fieldContainer && fieldContainer.getValue) {
        values[field.id] = fieldContainer.getValue();
      }
    });
    return values;
  };
  
  // Reset the form
  form.resetForm = function() {
    form.reset();
    fields.forEach(field => {
      const fieldContainer = fieldContainers[field.id];
      if (fieldContainer) {
        fieldContainer.setValue('');
      }
    });
  };
  
  // Validate all fields
  form.validate = function() {
    let isValid = true;
    fields.forEach(field => {
      const fieldContainer = fieldContainers[field.id];
      if (fieldContainer && fieldContainer.validate) {
        if (!fieldContainer.validate()) {
          isValid = false;
        }
      }
    });
    return isValid;
  };
  
  return form;
}

// Export functions for module usage
if (typeof window !== 'undefined') {
  window.createNumberInput = createNumberInput;
  window.createTextInput = createTextInput;
  window.createSelectInput = createSelectInput;
  window.createForm = createForm;
}

export {
  createNumberInput,
  createTextInput,
  createSelectInput,
  createForm
};