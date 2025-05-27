
const container = document.getElementById("container")
const state = {
    packingLevelBoxes: {},
    altPackingStrats: {},
    resFilters: {},
    inputDims: [0, 0, 0],
    inputDimsSorted: [0, 0, 0],
    availableBoxes: [],
    printScale: 7,
}

function gen_checkBoxLabel(id, text, checked, state_collection) {
    const checkboxDiv = document.createElement("span")

    const label = document.createElement("label")
    label.textContent = text
    label.setAttribute("for", id)

    const checkbox = document.createElement("input")
    checkbox.setAttribute("type", "checkbox")
    checkbox.checked = checked
    checkbox.id = id

    state_collection[id] = checked

    function toggle() {
        state_collection[id] = !checkbox.checked    // ~ because the event runs first
        gen_chart()
    }
    label.addEventListener("mouseup", toggle)
    checkbox.addEventListener("mouseup", toggle)
    checkboxDiv.appendChild(checkbox)
    checkboxDiv.appendChild(label)
    return checkboxDiv
}

function gen_packingLevelBoxes() {
    const packingLevelBoxesDiv = document.createElement("div")
    packingLevelBoxesDiv.textContent = "Packing levels: "
    const np_checkBox = gen_checkBoxLabel("npCheckbox", "No Pack/Sell", false, state.packingLevelBoxes)
    const std_checkBox = gen_checkBoxLabel("stdCheckbox", "Standard Pack", true, state.packingLevelBoxes)
    const frag_checkBox = gen_checkBoxLabel("fragCheckbox", "Fragile Pack", false, state.packingLevelBoxes)
    const cust_checkBox = gen_checkBoxLabel("custCheckbox", "Custom Pack", false, state.packingLevelBoxes)
    // const tele_checkBox = gen_checkBoxLabel("teleCheckbox", "Telescope Pack", false, state.packingLevelBoxes)
    packingLevelBoxesDiv.appendChild(np_checkBox)
    packingLevelBoxesDiv.appendChild(std_checkBox)
    packingLevelBoxesDiv.appendChild(frag_checkBox)
    packingLevelBoxesDiv.appendChild(cust_checkBox)
    // packingLevelBoxesDiv.appendChild(tele_checkBox)

    container.appendChild(packingLevelBoxesDiv)
}

function gen_altPackingStrategies() {
    const strategiesDiv = document.createElement("div")
    strategiesDiv.textContent = "Packing Strategies: "
    const normalBox = gen_checkBoxLabel("normalCheckbox", "Normal", true, state.altPackingStrats)
    const cutDownBox = gen_checkBoxLabel("cutDownCheckbox", "Cut Down", false, state.altPackingStrats)
    const telescopeBox = gen_checkBoxLabel("telescopeCheckbox", "Telescoping", false, state.altPackingStrats)
    const cheatingBox = gen_checkBoxLabel("cheatingCheckbox", "Cheating", false, state.altPackingStrats)
    const flatBox = gen_checkBoxLabel("flatCheckbox", "Flattened", false, state.altPackingStrats)

    strategiesDiv.appendChild(normalBox)
    strategiesDiv.appendChild(cutDownBox)
    strategiesDiv.appendChild(telescopeBox)
    strategiesDiv.appendChild(cheatingBox)
    strategiesDiv.appendChild(flatBox)

    container.appendChild(strategiesDiv)
    
}

function gen_configBoxes() {
    const configDiv = document.createElement("div")
    configDiv.textContent = "Result Filter: "
    const showImpossible = gen_checkBoxLabel("showImpossible", "Show impossible boxes", false, state.resFilters)
    const showNoSpace = gen_checkBoxLabel("showNoSpace", "Show no space boxes", false, state.resFilters)
    const showPossible = gen_checkBoxLabel("showPossible", "Show possible boxes", true, state.resFilters)
    const scorePriority = gen_checkBoxLabel("scorePriority", "Sort by score", false, state.resFilters)

    configDiv.appendChild(scorePriority)
    configDiv.appendChild(showImpossible)
    configDiv.appendChild(showNoSpace)
    configDiv.appendChild(showPossible)

    container.appendChild(configDiv)
}

function gen_dimInputs() {
    const inputDiv = document.createElement("div")

    const inOne = document.createElement("input")
    inOne.setAttribute("placeholder", "x")
    const inTwo = document.createElement("input")
    inTwo.setAttribute("placeholder", "y")
    const inThree = document.createElement("input")
    inThree.setAttribute("placeholder", "z")

    const clearBtn = document.createElement("button")
    clearBtn.textContent = "Clear inputs"
    inputDiv.appendChild(clearBtn)
    clearBtn.addEventListener("mouseup", () => {
        const chartDiv = document.getElementById("chartContainer")
        if (chartDiv) {
            chartDiv.remove()
        }
        inOne.value = ""
        inTwo.value = ""
        inThree.value = ""
        state.inputDims = [0, 0, 0]
        inOne.focus()
    })

    inOne.addEventListener("keyup", (e) => {
        const val = parseInt(e.target.value)
        if (!isNaN(val)) {    
            state.inputDims[0] = val
            state.inputDimsSorted = state.inputDims.toSorted((a, b) => {return b - a}) 
            gen_chart()
        }
    })
    inTwo.addEventListener("keyup", (e) => {
        const val = parseInt(e.target.value)
        if (!isNaN(val)) {
            state.inputDims[1] = val
            state.inputDimsSorted = state.inputDims.toSorted((a, b) => {return b - a}) 
            gen_chart()
        }
    })
    inThree.addEventListener("keyup", (e) => {
        const val = parseInt(e.target.value)
        if (!isNaN(val)) {
            state.inputDims[2] = val
            state.inputDimsSorted = state.inputDims.toSorted((a, b) => {return b - a}) 
            gen_chart()
        }
    })

    inputDiv.appendChild(inOne)
    inputDiv.appendChild(inTwo)
    inputDiv.appendChild(inThree)

    container.appendChild(inputDiv)

}

function gen_html() {
    const infoDiv = document.createElement("div")

    // Clickable help button
    const helpButton = document.createElement("button")
    infoDiv.appendChild(helpButton)
    helpButton.textContent = "Help"
    helpButton.addEventListener("click", () => {
        const helpDiv = document.getElementById("helpDiv")
        if (helpDiv) {
            helpDiv.remove()
        } else {
            const helpDiv = document.createElement("div")
            helpDiv.id = "helpDiv"
            helpDiv.innerHTML =
                `<div>The first row filters which packing levels are shown. </div>
                <div>These levels expect a minimum amount of packing material to be used. In order, they are 0in, 2in, 4in, 6in.</div>
                <div>Packing strategies are the methods used to pack the item. </div>
                <div>Normal - The item is packed normally.</div>
                <div>Telescoping - The item is packed by sticking multiple boxes together telescope style.</div>
                <div>Cheating - The item is packed by rotating the item in the box to take <a href="https://stackoverflow.com/questions/69763451/how-to-get-height-and-width-of-element-when-it-is-rotated">advantage of pythagoras</a></div>
                <div>Flattened - The item (paper) is packed by sliding it into the box and taping up the ends without folding it.</div>
                <div>Sort by score orders the boxes by score (how well the item fits in the box) or price</div>
                <div>A lower score is better because it means there is less "error".</div>
                <div>Next are toggles to filter which recomendation levels should be present</div>
                <div>Impossible - The item is too big for the box</div>
                <div>No space - The item theoretically fits, but there is 0 space left in the box for at least 1 dimension</div>
                <div>Possible - The item fits, but there some packing material space will be sacrificed</div>
                <div>fits - The item fits in the box without any isuses and can be packed as desired (probably with extra space to work with)</div>
                <div>The last row is the input for the dimensions of the item to be packed. (Order doesn't matter) </div>
                `
            helpDiv.style.backgroundColor = "#bbbbbb"
            infoDiv.appendChild(helpDiv)
        }
    })

    // Clickable debug button
    const debugButton = document.createElement("button")
    infoDiv.appendChild(debugButton)
    debugButton.textContent = "Show Debug"
    debugButton.addEventListener("click", () => {
        const debugDiv = document.getElementById("debugDiv")
        if (debugDiv) {
            debugDiv.remove()
        } else {
            const debugDiv = document.createElement("div")
            debugDiv.id = "debugDiv"
            
            const dumpBtn = document.createElement("button")
            dumpBtn.textContent = "Dump state"
            dumpBtn.addEventListener("click", () => {
                // Only in debug mode - log state to console
                console.log(state)
            })
            debugDiv.appendChild(dumpBtn)

            const scaleVal = document.createElement("input")
            scaleVal.setAttribute("type", "number")
            scaleVal.value = state.printScale
            scaleVal.addEventListener("change", (e) => {
                const val = parseFloat(e.target.value)
                if (!isNaN(val)) {
                    state.printScale = val
                    gen_chart()
                }
            })
            debugDiv.appendChild(document.createTextNode("Print scale: "))
            debugDiv.appendChild(scaleVal)

            const commentBox = document.createElement("input")
            commentBox.setAttribute("type", "text")
            commentBox.setAttribute("placeholder", "Comment")
            const commentBtn = document.createElement("button")
            commentBtn.textContent = "Send comment"
            commentBtn.addEventListener("click", () => {
                const comment = commentBox.value
                commentBox.value = ""
                if (comment) {
                    fetch("/comments", {
                        method: "POST",
                        body: JSON.stringify({text: comment}),
                        headers: {
                            "Content-Type": "application/json"
                        }
                    })
                }
            })
            debugDiv.appendChild(commentBox)
            debugDiv.appendChild(commentBtn)

            infoDiv.appendChild(debugDiv)
        }
    })
    
    container.appendChild(infoDiv)
    gen_packingLevelBoxes()
    gen_altPackingStrategies()
    gen_configBoxes()
    gen_dimInputs()
}

function gen_chart() {
    let chartDiv = document.getElementById("chartContainer")
    if (chartDiv) {
        chartDiv.remove()
    }
    chartDiv = document.createElement("div")
    chartDiv.id = "chartContainer"
    const table = document.createElement("table")
    const header = document.createElement("tr")
    for (const text of ["Tightness (Extra Volume)", "Box Dims", "Pack Level", "Price", "Recomendation", "Pack Strategy", "Comments"]) {
        const th = document.createElement("th")
        th.textContent = text
        header.appendChild(th)
    };
    table.appendChild(header)

    const checkBoxState = {     // Provides a mapping from boxResult generation to the checkboxes
        "No Pack": state.packingLevelBoxes["npCheckbox"],
        "Standard Pack": state.packingLevelBoxes["stdCheckbox"],
        "Fragile Pack": state.packingLevelBoxes["fragCheckbox"],
        "Custom Pack": state.packingLevelBoxes["custCheckbox"],
        "Normal": state.altPackingStrats["normalCheckbox"],
        "Cut Down": state.altPackingStrats["cutDownCheckbox"],
        "Telescoping": state.altPackingStrats["telescopeCheckbox"],
        "Cheating": state.altPackingStrats["cheatingCheckbox"],
        "Flattened": state.altPackingStrats["flatCheckbox"],
        "fits": true,
        "possible": state.resFilters["showPossible"],
        "no space": state.resFilters["showNoSpace"],
        "impossible": state.resFilters["showImpossible"],
    }
    const boxResultCollection = []
    for (const box of state.availableBoxes) {
        const boxResults = box.gen_boxResults(state.inputDimsSorted)

        // Process boxResults for display
        for (const packingLevel of Object.keys(boxResults)) {
            if (checkBoxState[packingLevel]) {
                for (const packingStrategy of Object.keys(boxResults[packingLevel])) {
                    if (checkBoxState[packingStrategy]) {
                        if (checkBoxState[boxResults[packingLevel][packingStrategy].recomendationLevel]) {
                            boxResultCollection.push(boxResults[packingLevel][packingStrategy])
                        }
                    }
                }

            }
        }
    }
    if (state.resFilters["scorePriority"]) {
        boxResultCollection.sort((a, b) => {return (a.score * 1000 + a.price) - (b.score * 1000 + b.price)})    // Use other as a tie breaker
    } else {
        boxResultCollection.sort((a, b) => {return (a.price * 1000 + a.score) - (b.price * 1000 + b.score)})
    }
    if (boxResultCollection.length == 0) {
        const noResults = document.createElement("div")
        noResults.textContent = "No results found"
        noResults.style.fontSize = "1vw"
        noResults.style.margin = "10px"
        chartDiv.appendChild(noResults)
        container.appendChild(chartDiv)
        return
    }
    for (const result of boxResultCollection) {
        const row = document.createElement("tr")
        const score = document.createElement("td")
        score.style.padding = "2px"
        score.textContent = result.score
        const boxDims = document.createElement("td")
        boxDims.textContent = `[${result.dimensions[0]}, ${result.dimensions[1]}, ${result.dimensions[2]}]`
        const packLevel = document.createElement("td")
        if (result.packLevel == "No Pack") {
            packLevel.textContent = "Box"
        } else {
            packLevel.textContent = result.packLevel
        }
        const price = document.createElement("td")
        price.textContent = result.price.toFixed(2)
        const recomendation = document.createElement("td")
        recomendation.textContent = result.recomendationLevel
        const strategy = document.createElement("td")
        strategy.textContent = result.strategy
        const comment = document.createElement("td")
        comment.textContent = result.comment

        row.appendChild(score)
        row.appendChild(boxDims)
        row.appendChild(packLevel)
        row.appendChild(price)
        row.appendChild(recomendation)
        row.appendChild(strategy)
        row.appendChild(comment)

        // printing
        const printBtn = document.createElement("button")
    
        printBtn.textContent = "Print"
        printBtn.addEventListener("click", () => {
            var frame = document.createElement('iframe');
            frame.srcdoc = 
            `<html>
                <head><title>Print</title>
                <style>
                    div {
                        font-size: ${state.printScale}vw;
                    }
                    span {
                        margin-left: 10vw;
                    }
                </style>
                </head>
                <body onload="window.print()">
                <div>
                    Original Box dimensions: <br>
                    <span>${boxDims.outerHTML}</span> <br>
                    Packing level: <br>
                    <span>${packLevel.outerHTML}</span> <br>
                    Packing strategy: <br>
                    <span>${strategy.outerHTML}</span> <br>
                    Price: $${price.outerHTML} <br> 
                    Recomendation: <br>
                    <span>${recomendation.outerHTML}</span> <br>
                    Comments: ${comment.outerHTML} <br>
                </div>
                </body>
            </html>`;
            document.body.appendChild(frame);
            setTimeout(() => {
                frame.remove();
            }, 1000);
        })
        row.appendChild(printBtn)

        table.appendChild(row)
    }
    chartDiv.appendChild(table)
    container.appendChild(chartDiv)
}

// BoxResult and Box classes are now imported from packing.js

// Load boxes from API - now uses the loadBoxes function from packing.js
async function load_boxes() {
    try {
        // Get store ID from auth context
        const storeId = AuthManager.getCurrentStoreId();
        if (!storeId) {
            throw new Error("No store selected. Please login first.");
        }

        // Use the loadBoxes function from packing.js
        return await window.loadBoxes(storeId);
    } catch (error) {
        console.error("Error loading boxes:", error);
        throw error;
    }
}


// Initialize the app
async function initialize() {
    gen_html();

    try {
        state.availableBoxes = await load_boxes();
        gen_chart();
    } catch (error) {
        console.error("Error loading boxes:", error);

        // Create a user-friendly error message
        const container = document.getElementById("container");

        // Clear any existing content
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }

        const errorDiv = document.createElement("div");
        errorDiv.style.padding = "20px";
        errorDiv.style.margin = "20px";
        errorDiv.style.backgroundColor = "#ffdddd";
        errorDiv.style.border = "1px solid #ff0000";
        errorDiv.style.borderRadius = "5px";

        const errorTitle = document.createElement("h2");
        errorTitle.textContent = "Error Loading Boxes";
        errorTitle.style.color = "#cc0000";
        errorDiv.appendChild(errorTitle);

        const errorMessage = document.createElement("p");
        errorMessage.textContent = error.message;
        errorDiv.appendChild(errorMessage);

        const errorHelp = document.createElement("p");
        // Get store ID from auth context
        const storeId = AuthManager.getCurrentStoreId() || 'unknown';

        errorHelp.innerHTML = `<b>Troubleshooting tips:</b>
        <ul>
            <li>Check that the FastAPI server is running</li>
            <li>Verify that the stores/store${storeId}.yml file exists and is properly formatted</li>
            <li>Check the server logs for more details</li>
            <li>Make sure you're accessing a valid store ID in the URL path (e.g., /1, /2, etc.)</li>
        </ul>`;
        errorDiv.appendChild(errorHelp);

        container.appendChild(errorDiv);
    }
}

// Execute initialization immediately - no need to wait for DOMContentLoaded as script is already deferred
initialize();