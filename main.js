console.log("Portal Architect loaded");

const commitFooter = document.getElementById("commitFooter");

function getCountFromResponse(response) {
    const linkHeader = response.headers.get("Link");

    if (linkHeader) {
        const match = linkHeader.match(/[?&]page=(\d+)>;\s*rel="last"/);
        if (match) {
            return Number(match[1]);
        }
    }

    if (response.ok) {
        return 1;
    }

    return null;
}

let debugCommitStatus = null;
let debugDeployStatus = null;
let debugRateRemaining = null;

Promise.all([
    fetch("https://api.github.com/repos/Creator657/Portal-Architect/commits?per_page=1"),
    fetch("https://api.github.com/repos/Creator657/Portal-Architect/deployments?per_page=1")
])
    .then(function (responses) {
        const [commitsResponse, deploymentsResponse] = responses;

        debugCommitStatus = commitsResponse.status;
        debugDeployStatus = deploymentsResponse.status;
        debugRateRemaining = commitsResponse.headers.get("X-RateLimit-Remaining");

        if (!commitsResponse.ok || !deploymentsResponse.ok) {
            throw new Error("GitHub API request failed (status " + debugCommitStatus + "/" + debugDeployStatus + ")");
        }

        const commitCount = getCountFromResponse(commitsResponse);
        const deploymentCount = getCountFromResponse(deploymentsResponse);

        if (commitCount === null || deploymentCount === null) {
            throw new Error("Could not parse commit or deployment count");
        }

        const timestamp = Date.now().toString(36);
        commitFooter.textContent = "Debug ID: PA-" + timestamp +
            "-C" + commitCount +
            "-D" + deploymentCount +
            "-R" + (debugRateRemaining !== null ? debugRateRemaining : "NA");
        commitFooter.style.color = "#8a6fa8";
    })
    .catch(function (err) {
        const timestamp = Date.now().toString(36);
        const debugId = "PA-" + timestamp +
            "-C" + (debugCommitStatus !== null ? debugCommitStatus : "NA") +
            "-D" + (debugDeployStatus !== null ? debugDeployStatus : "NA") +
            "-R" + (debugRateRemaining !== null ? debugRateRemaining : "NA");

        commitFooter.textContent = "Unable to load repository stats. (Debug ID: " + debugId + ")";
        commitFooter.style.color = "#ff8a8a";

        console.error("Footer stats fetch failed.", {
            debugId: debugId,
            message: err.message,
            commitStatus: debugCommitStatus,
            deployStatus: debugDeployStatus,
            rateLimitRemaining: debugRateRemaining,
            timeISO: new Date().toISOString()
        });
    });

const mobileToggle = document.getElementById("mobileToggle");

mobileToggle.addEventListener("change", function () {
    document.body.classList.toggle("mobile-mode", mobileToggle.checked);
});

const howToBtn = document.getElementById("howToBtn");
const howToModal = document.getElementById("howToModal");
const howToCloseBtn = document.getElementById("howToCloseBtn");

howToBtn.addEventListener("click", function () {
    howToModal.hidden = false;
});

howToCloseBtn.addEventListener("click", function () {
    howToModal.hidden = true;
});

howToModal.addEventListener("click", function (event) {
    if (event.target === howToModal) {
        howToModal.hidden = true;
    }
});

document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !howToModal.hidden) {
        howToModal.hidden = true;
    }
});

const themeMenuBtn = document.getElementById("themeMenuBtn");
const themeMenu = document.getElementById("themeMenu");
const themeMenuItems = Array.from(document.querySelectorAll(".theme-menu-item"));

function closeThemeMenu() {
    themeMenu.hidden = true;
    themeMenuBtn.setAttribute("aria-expanded", "false");
}

themeMenuBtn.addEventListener("click", function (event) {
    event.stopPropagation();
    const isOpen = !themeMenu.hidden;
    if (isOpen) {
        closeThemeMenu();
    } else {
        themeMenu.hidden = false;
        themeMenuBtn.setAttribute("aria-expanded", "true");
    }
});

themeMenuItems.forEach(function (item) {
    item.addEventListener("click", function () {
        themeMenuItems.forEach(function (i) {
            i.classList.remove("active");
        });
        item.classList.add("active");

        document.body.classList.remove("theme-nether", "theme-overworld", "theme-deepdark");
        if (item.dataset.theme !== "nether") {
            document.body.classList.add("theme-" + item.dataset.theme);
        }

        closeThemeMenu();
    });
});

document.addEventListener("click", function (event) {
    if (!themeMenu.hidden && !themeMenu.contains(event.target) && event.target !== themeMenuBtn) {
        closeThemeMenu();
    }
});

// --- Element references --------------------------------------------------

const motherXInput = document.getElementById("motherX");
const motherZInput = document.getElementById("motherZ");
const radiusField = document.getElementById("radius");
const generateBtn = document.getElementById("generateBtn");
const editCoordsBtn = document.getElementById("editCoordsBtn");
const errorEl = document.getElementById("formError");
const noticeEl = document.getElementById("radiusNotice");

const loadingContainer = document.getElementById("loadingContainer");
const progressFill = document.getElementById("progressFill");
const progressLabel = document.getElementById("progressLabel");
const progressCount = document.getElementById("progressCount");
const loadingStatus = document.getElementById("loadingStatus");

const toolsSection = document.getElementById("toolsSection");
const tabButtons = Array.from(document.querySelectorAll(".tab-btn"));
const tabPanels = {
    grid: document.getElementById("panel-grid"),
    search: document.getElementById("panel-search"),
    nearest: document.getElementById("panel-nearest"),
    distance: document.getElementById("panel-distance"),
    slot: document.getElementById("panel-slot"),
    save: document.getElementById("panel-save")
};

function showError(message) {
    errorEl.textContent = message;
}

function showNotice(message) {
    noticeEl.textContent = message;
}

function sleep(ms) {
    return new Promise(function (resolve) {
        setTimeout(resolve, ms);
    });
}

// --- Shared grid math -----------------------------------------------------

function getPortalName(x, z) {
    if (x === 0 && z === 0) {
        return "M";
    }
    let name = "";
    if (z > 0) name += "N" + z;
    if (z < 0) name += "S" + Math.abs(z);
    if (x > 0) name += "E" + x;
    if (x < 0) name += "W" + Math.abs(x);
    return name;
}

// The Mother Portal's anchor point, set once Generate succeeds and locked
// until Edit Coordinates is used. Tools read from here to stay consistent
// with what's actually on screen.
let motherAnchor = null; // { netherX, netherZ, overworldX, overworldZ, radius }

function findNearestLatticePoint(targetOverworldX, targetOverworldZ) {
    const targetNetherX = targetOverworldX / 8;
    const targetNetherZ = targetOverworldZ / 8;

    const x = Math.round((targetNetherX - motherAnchor.netherX) / 35);
    const z = Math.round((targetNetherZ - motherAnchor.netherZ) / 40);

    const portalNetherX = motherAnchor.netherX + x * 35;
    const portalNetherZ = motherAnchor.netherZ + z * 40;

    const isCenter = x === 0 && z === 0;
    const portalOverworldX = isCenter ? motherAnchor.overworldX : Math.round(portalNetherX * 8);
    const portalOverworldZ = isCenter ? motherAnchor.overworldZ : Math.round(portalNetherZ * 8);

    return {
        x: x,
        z: z,
        name: getPortalName(x, z),
        netherX: portalNetherX,
        netherZ: portalNetherZ,
        overworldX: portalOverworldX,
        overworldZ: portalOverworldZ
    };
}

function highlightCard(card) {
    card.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    card.classList.add("highlighted-portal");
    setTimeout(function () {
        card.classList.remove("highlighted-portal");
    }, 2200);
    selectPortal(card);
}

function findCardByName(name) {
    return Array.from(document.querySelectorAll(".portal-card")).find(function (card) {
        return card.dataset.portalName === name || card.dataset.customName === name;
    }) || null;
}

function findCardByOffset(x, z) {
    return Array.from(document.querySelectorAll(".portal-card")).find(function (card) {
        return Number(card.dataset.x) === x && Number(card.dataset.z) === z;
    }) || null;
}

// Custom names, keyed by "x,z". Session-only — cleared whenever the grid is
// rebuilt via Edit Coordinates, same as selection.
let customNames = {};

function getCustomNameFontSize(length) {
    if (length <= 6) return "20px";
    if (length <= 9) return "16px";
    return "13px";
}

function refreshCardName(card) {
    const key = card.dataset.x + "," + card.dataset.z;
    const customName = customNames[key];
    const nameEl = card.querySelector(".portal-name");
    const autoName = card.dataset.portalName;

    if (customName) {
        card.dataset.customName = customName;
        const fontSize = getCustomNameFontSize(customName.length);
        nameEl.innerHTML = '<span style="font-size:' + fontSize + '">' + customName + '</span>' +
            '<div class="portal-auto-name">' + autoName + "</div>";
    } else {
        delete card.dataset.customName;
        nameEl.textContent = autoName;
    }
}

// --- Categories / tags ------------------------------------------------------
// Session-only, same lifecycle as custom names — cleared on Edit Coordinates.

const CATEGORIES = [
    { id: "base", label: "Base", color: "#4caf50" },
    { id: "mining", label: "Mining", color: "#8d6e63" },
    { id: "farm", label: "Farm", color: "#cddc39" },
    { id: "trading", label: "Trading", color: "#ffb300" },
    { id: "hub", label: "Nether Hub", color: "#e91e63" }
];

function getCategoryById(id) {
    return CATEGORIES.find(function (cat) {
        return cat.id === id;
    }) || null;
}

let portalCategories = {};

function refreshCardCategory(card) {
    const key = card.dataset.x + "," + card.dataset.z;
    const categoryId = portalCategories[key];
    const frame = card.querySelector(".portal-frame");
    let dot = frame.querySelector(".portal-category-dot");

    if (categoryId) {
        const category = getCategoryById(categoryId);
        card.dataset.category = categoryId;
        if (!dot) {
            dot = document.createElement("span");
            dot.className = "portal-category-dot";
            frame.appendChild(dot);
        }
        dot.style.background = category.color;
        dot.title = category.label;
    } else {
        delete card.dataset.category;
        if (dot) {
            dot.remove();
        }
    }
}

// --- Portal status + notes --------------------------------------------------
// Same session-only lifecycle as names and categories.

const STATUSES = [
    { id: "planned", label: "Planned", color: "#42a5f5" },
    { id: "in-progress", label: "In Progress", color: "#ff9800" },
    { id: "built", label: "Built", color: "#4caf50" }
];

function getStatusById(id) {
    return STATUSES.find(function (s) {
        return s.id === id;
    }) || null;
}

let portalStatuses = {};
let portalNotes = {};

function refreshCardDetails(card) {
    const key = card.dataset.x + "," + card.dataset.z;
    const frame = card.querySelector(".portal-frame");

    const statusId = portalStatuses[key];
    let statusDot = frame.querySelector(".portal-status-dot");
    if (statusId) {
        const status = getStatusById(statusId);
        card.dataset.status = statusId;
        if (!statusDot) {
            statusDot = document.createElement("span");
            statusDot.className = "portal-status-dot";
            frame.appendChild(statusDot);
        }
        statusDot.style.background = status.color;
        statusDot.title = status.label;
    } else {
        delete card.dataset.status;
        if (statusDot) {
            statusDot.remove();
        }
    }

    const note = portalNotes[key];
    let notesIcon = frame.querySelector(".portal-notes-icon");
    if (note) {
        card.dataset.notes = note;
        if (!notesIcon) {
            notesIcon = document.createElement("span");
            notesIcon.className = "portal-notes-icon";
            notesIcon.textContent = "📝";
            frame.appendChild(notesIcon);
        }
        notesIcon.title = note;
    } else {
        delete card.dataset.notes;
        if (notesIcon) {
            notesIcon.remove();
        }
    }
}

// --- Portal selection + global copy button ----------------------------------

const globalCopyBtn = document.getElementById("globalCopyBtn");
let selectedPortal = null;

function selectPortal(card) {
    const previous = document.querySelector(".portal-card.selected-portal");
    if (previous) {
        previous.classList.remove("selected-portal");
    }
    card.classList.add("selected-portal");

    selectedPortal = {
        name: card.dataset.portalName,
        customName: card.dataset.customName || null,
        categoryId: card.dataset.category || null,
        statusId: card.dataset.status || null,
        notes: card.dataset.notes || "",
        overworldX: Number(card.dataset.overworldX),
        overworldZ: Number(card.dataset.overworldZ),
        netherX: Number(card.dataset.netherX),
        netherZ: Number(card.dataset.netherZ)
    };

    globalCopyBtn.disabled = false;
    globalCopyBtn.title = "Copy " + (selectedPortal.customName || selectedPortal.name);

    renameMenuBtn.disabled = false;
    renameMenuBtn.title = "Edit details for " + (selectedPortal.customName || selectedPortal.name);

    tagMenuBtn.disabled = false;
    tagMenuBtn.title = "Tag " + (selectedPortal.customName || selectedPortal.name);
}

function clearSelectedPortal() {
    const previous = document.querySelector(".portal-card.selected-portal");
    if (previous) {
        previous.classList.remove("selected-portal");
    }
    selectedPortal = null;
    globalCopyBtn.disabled = true;
    globalCopyBtn.title = "Select a portal first";

    renameMenuBtn.disabled = true;
    renameMenuBtn.title = "Select a portal first";
    renameMenu.hidden = true;

    tagMenuBtn.disabled = true;
    tagMenuBtn.title = "Select a portal first";
    tagMenu.hidden = true;
}

globalCopyBtn.addEventListener("click", function () {
    if (selectedPortal === null) {
        return;
    }

    const label = selectedPortal.customName ? selectedPortal.customName + " (" + selectedPortal.name + ")" : selectedPortal.name;
    const category = selectedPortal.categoryId ? getCategoryById(selectedPortal.categoryId) : null;
    const categoryText = category ? " [" + category.label + "]" : "";

    const text = label + categoryText + " | Overworld " + selectedPortal.overworldX + ", " + selectedPortal.overworldZ +
        " | Nether " + selectedPortal.netherX + ", " + selectedPortal.netherZ;

    navigator.clipboard.writeText(text)
        .then(function () {
            globalCopyBtn.textContent = "✅";
            setTimeout(function () {
                globalCopyBtn.textContent = "📋";
            }, 1400);
        })
        .catch(function () {
            globalCopyBtn.textContent = "❌";
            setTimeout(function () {
                globalCopyBtn.textContent = "📋";
            }, 1400);
        });
});

// --- Rename / details panel (name, status, notes) ---------------------------

const renameMenuBtn = document.getElementById("renameMenuBtn");
const renameMenu = document.getElementById("renameMenu");
const renameTargetName = document.getElementById("renameTargetName");
const renameInput = document.getElementById("renameInput");
const statusSelect = document.getElementById("statusSelect");
const notesInput = document.getElementById("notesInput");
const renameSaveBtn = document.getElementById("renameSaveBtn");
const renameClearBtn = document.getElementById("renameClearBtn");

renameMenuBtn.addEventListener("click", function (event) {
    event.stopPropagation();

    if (selectedPortal === null) {
        return;
    }

    const isOpen = !renameMenu.hidden;
    if (isOpen) {
        renameMenu.hidden = true;
        return;
    }

    renameTargetName.textContent = selectedPortal.name;
    renameInput.value = selectedPortal.customName || "";
    statusSelect.value = selectedPortal.statusId || "";
    notesInput.value = selectedPortal.notes || "";
    renameMenu.hidden = false;
    renameInput.focus();
});

renameSaveBtn.addEventListener("click", function () {
    if (selectedPortal === null) {
        return;
    }

    const card = document.querySelector(".portal-card.selected-portal");
    if (!card) {
        return;
    }

    const key = card.dataset.x + "," + card.dataset.z;

    const nameValue = renameInput.value.trim();
    if (nameValue === "") {
        delete customNames[key];
    } else {
        customNames[key] = nameValue;
    }

    const statusValue = statusSelect.value;
    if (statusValue === "") {
        delete portalStatuses[key];
    } else {
        portalStatuses[key] = statusValue;
    }

    const notesValue = notesInput.value.trim();
    if (notesValue === "") {
        delete portalNotes[key];
    } else {
        portalNotes[key] = notesValue;
    }

    refreshCardName(card);
    refreshCardDetails(card);
    selectPortal(card); // refresh selectedPortal + button titles with the new data
    renameMenu.hidden = true;
});

renameClearBtn.addEventListener("click", function () {
    renameInput.value = "";
    statusSelect.value = "";
    notesInput.value = "";
    renameSaveBtn.click();
});

document.addEventListener("click", function (event) {
    if (!renameMenu.hidden && !renameMenu.contains(event.target) && event.target !== renameMenuBtn) {
        renameMenu.hidden = true;
    }
});

// --- Tag / category picker ---------------------------------------------------

const tagMenuBtn = document.getElementById("tagMenuBtn");
const tagMenu = document.getElementById("tagMenu");

tagMenuBtn.addEventListener("click", function (event) {
    event.stopPropagation();

    if (selectedPortal === null) {
        return;
    }

    const isOpen = !tagMenu.hidden;
    if (isOpen) {
        tagMenu.hidden = true;
        return;
    }

    Array.from(tagMenu.querySelectorAll(".tag-menu-item")).forEach(function (item) {
        item.classList.toggle("active", item.dataset.category === selectedPortal.categoryId);
    });

    tagMenu.hidden = false;
});

tagMenu.addEventListener("click", function (event) {
    const item = event.target.closest(".tag-menu-item");
    if (!item || selectedPortal === null) {
        return;
    }

    const card = document.querySelector(".portal-card.selected-portal");
    if (!card) {
        return;
    }

    const key = card.dataset.x + "," + card.dataset.z;
    const categoryId = item.dataset.category;

    if (categoryId === "none") {
        delete portalCategories[key];
    } else {
        portalCategories[key] = categoryId;
    }

    refreshCardCategory(card);
    selectPortal(card);
    tagMenu.hidden = true;
});

document.addEventListener("click", function (event) {
    if (!tagMenu.hidden && !tagMenu.contains(event.target) && event.target !== tagMenuBtn) {
        tagMenu.hidden = true;
    }
});

// --- Tab switching ---------------------------------------------------------

function activateTab(tabName) {
    tabButtons.forEach(function (btn) {
        btn.classList.toggle("active", btn.dataset.tab === tabName);
    });
    Object.keys(tabPanels).forEach(function (key) {
        tabPanels[key].hidden = key !== tabName;
    });
}

tabButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
        activateTab(btn.dataset.tab);
    });
});

// --- Progress bar helpers ---------------------------------------------------

function updateProgress(loaded, total, label) {
    const percent = Math.round((loaded / total) * 100);
    progressFill.style.width = percent + "%";
    progressLabel.textContent = label;
    progressCount.textContent = loaded + " / " + total + " items loaded (" + percent + "%)";
}

function resetLoadingUI() {
    progressFill.style.width = "0%";
    progressLabel.textContent = "";
    progressCount.textContent = "";
    loadingStatus.textContent = "";
    loadingStatus.style.color = "#8a6fa8";
}

// --- Grid building (actual DOM work, called partway through the sequence) --

function buildGrid(overworldX, overworldZ, radius, netherX, netherZ) {
    const results = document.getElementById("results");
    results.innerHTML = "";

    for (let z = radius; z >= -radius; z--) {

        const row = document.createElement("div");
        row.className = "portal-row";

        for (let x = -radius; x <= radius; x++) {

            const card = document.createElement("div");
            card.className = "portal-card";

            const isCenter = x === 0 && z === 0;
            const name = getPortalName(x, z);

            if (isCenter) {
                card.classList.add("mother-portal");
            }

            const portalNetherX = netherX + (x * 35);
            const portalNetherZ = netherZ + (z * 40);

            const portalOverworldX = isCenter ? overworldX : Math.round(portalNetherX * 8);
            const portalOverworldZ = isCenter ? overworldZ : Math.round(portalNetherZ * 8);

            card.dataset.portalName = name;
            card.dataset.x = x;
            card.dataset.z = z;
            card.dataset.overworldX = portalOverworldX;
            card.dataset.overworldZ = portalOverworldZ;
            card.dataset.netherX = portalNetherX;
            card.dataset.netherZ = portalNetherZ;

            card.innerHTML = `
<div class="portal-frame">

    <div class="portal-center">

        <div class="portal-name">
            ${name}
        </div>

        <div class="portal-coords">

            Over World
            <br>

            X: ${portalOverworldX}

            <br>

            Z: ${portalOverworldZ}

            <br><br>

            Nether
            <br>

            X: ${portalNetherX}

            <br>

            Z: ${portalNetherZ}

        </div>

    </div>

</div>
`;

            refreshCardName(card);
            refreshCardCategory(card);
            refreshCardDetails(card);

            card.addEventListener("click", function () {
                selectPortal(card);
            });

            row.appendChild(card);
        }

        results.appendChild(row);
    }
}

// --- Lock / unlock the Mother Portal card -----------------------------------

function lockMotherCard() {
    motherXInput.disabled = true;
    motherZInput.disabled = true;
    radiusField.disabled = true;
    generateBtn.style.display = "none";
    editCoordsBtn.style.display = "block";
}

function unlockMotherCard() {
    motherXInput.disabled = false;
    motherZInput.disabled = false;
    radiusField.disabled = false;
    generateBtn.style.display = "block";
    editCoordsBtn.style.display = "none";
}

function resetGridState() {
    unlockMotherCard();
    motherAnchor = null;
    toolsSection.style.display = "none";
    loadingContainer.style.display = "none";
    resetLoadingUI();
    document.getElementById("results").innerHTML = "";
    clearSelectedPortal();
    customNames = {};
    portalCategories = {};
    portalStatuses = {};
    portalNotes = {};
    activateTab("grid");
    errorEl.textContent = "";
    noticeEl.textContent = "";
}

editCoordsBtn.addEventListener("click", resetGridState);

// --- Radius live rounding notice ---------------------------------------------

radiusField.addEventListener("input", function () {
    const rawValue = radiusField.value.trim();

    if (rawValue === "") {
        noticeEl.textContent = "";
        return;
    }

    const numericValue = Number(rawValue);

    if (Number.isNaN(numericValue)) {
        noticeEl.textContent = "";
        return;
    }

    const truncated = Math.trunc(numericValue);

    if (truncated !== numericValue) {
        showNotice("Rounding radius to " + truncated + ".");
    } else {
        noticeEl.textContent = "";
    }
});

// --- Generate: validate, then run the staged loading sequence ----------------

async function runGenerateSequence(overworldX, overworldZ, radius) {
    generateBtn.disabled = true;
    loadingContainer.style.display = "block";
    resetLoadingUI();

    const netherX = Math.round(overworldX / 8);
    const netherZ = Math.round(overworldZ / 8);

    const totalPortals = (2 * radius + 1) * (2 * radius + 1);
    const totalItems = totalPortals + 4; // + Search, Nearest, Distance, Slot Finder
    let itemsLoaded = 0;

    try {
        updateProgress(itemsLoaded, totalItems, "Calculating Mother Portal anchor...");
        await sleep(250);

        updateProgress(itemsLoaded, totalItems, "Generating " + totalPortals + " portals...");
        await sleep(300);

        buildGrid(overworldX, overworldZ, radius, netherX, netherZ);

        itemsLoaded += totalPortals;
        updateProgress(itemsLoaded, totalItems, totalPortals + " portals generated.");
        await sleep(200);

        itemsLoaded += 1;
        updateProgress(itemsLoaded, totalItems, "Loading Search tool...");
        await sleep(200);

        itemsLoaded += 1;
        updateProgress(itemsLoaded, totalItems, "Loading Highlight Nearest tool...");
        await sleep(200);

        itemsLoaded += 1;
        updateProgress(itemsLoaded, totalItems, "Loading Distance Calculator...");
        await sleep(200);

        itemsLoaded += 1;
        updateProgress(itemsLoaded, totalItems, "Loading Slot Finder...");
        await sleep(200);

        motherAnchor = {
            netherX: netherX,
            netherZ: netherZ,
            overworldX: overworldX,
            overworldZ: overworldZ,
            radius: radius
        };

        loadingStatus.textContent = "Success — all tools loaded.";
        loadingStatus.style.color = "#8a6fa8";

        lockMotherCard();
        toolsSection.style.display = "block";
        activateTab("grid");

        return true;

    } catch (err) {
        loadingStatus.textContent = "Failed to generate the grid. Please try again.";
        loadingStatus.style.color = "#ff8a8a";
        motherAnchor = null;
        toolsSection.style.display = "none";
        console.error("Grid generation failed:", err);
        return false;
    } finally {
        generateBtn.disabled = false;
    }
}

generateBtn.addEventListener("click", async function () {

    errorEl.textContent = "";
    noticeEl.textContent = "";

    const overworldXInput = motherXInput.value.trim();
    const overworldZInput = motherZInput.value.trim();
    const radiusInput = radiusField.value.trim();

    if (overworldXInput === "" || overworldZInput === "" || radiusInput === "") {
        showError("Please fill in Overworld X, Overworld Z, and Grid Radius.");
        return;
    }

    const overworldX = Number(overworldXInput);
    const overworldZ = Number(overworldZInput);
    let radius = Number(radiusInput);

    if (Number.isNaN(overworldX) || Number.isNaN(overworldZ) || Number.isNaN(radius)) {
        showError("Coordinates and radius must be numbers.");
        return;
    }

    const truncatedRadius = Math.trunc(radius);

    if (truncatedRadius !== radius) {
        showNotice("Rounding radius to " + truncatedRadius + ".");
    }

    radius = truncatedRadius;

    if (radius < 1) {
        showError("Grid radius must be at least 1.");
        return;
    }

    if (radius > 15) {
        showError("Maximum grid radius is 15 for performance.");
        return;
    }

    await runGenerateSequence(overworldX, overworldZ, radius);
});

// --- Tool 1: Search portal by name --------------------------------------

const searchNameInput = document.getElementById("searchNameInput");
const searchNameBtn = document.getElementById("searchNameBtn");
const searchStatus = document.getElementById("searchStatus");

searchNameBtn.addEventListener("click", function () {
    searchStatus.textContent = "";

    const query = searchNameInput.value.trim();

    if (query === "") {
        searchStatus.style.color = "#ff8a8a";
        searchStatus.textContent = "Type a portal name first, e.g. N3E2.";
        return;
    }

    const card = findCardByName(query);

    if (!card) {
        searchStatus.style.color = "#ff8a8a";
        searchStatus.textContent = "\"" + query + "\" isn't in the currently generated grid.";
        return;
    }

    activateTab("grid");
    highlightCard(card);
    searchStatus.style.color = "#8a6fa8";
    searchStatus.textContent = "Found " + query + ".";
});

// --- Tool 2: Highlight nearest portal (within the current grid) --------

const nearestXInput = document.getElementById("nearestX");
const nearestZInput = document.getElementById("nearestZ");
const nearestBtn = document.getElementById("nearestBtn");
const nearestStatus = document.getElementById("nearestStatus");

nearestBtn.addEventListener("click", function () {
    nearestStatus.textContent = "";

    if (motherAnchor === null) {
        nearestStatus.style.color = "#ff8a8a";
        nearestStatus.textContent = "Generate a grid first.";
        return;
    }

    const xVal = nearestXInput.value.trim();
    const zVal = nearestZInput.value.trim();

    if (xVal === "" || zVal === "") {
        nearestStatus.style.color = "#ff8a8a";
        nearestStatus.textContent = "Enter both an Overworld X and Z.";
        return;
    }

    const targetX = Number(xVal);
    const targetZ = Number(zVal);

    if (Number.isNaN(targetX) || Number.isNaN(targetZ)) {
        nearestStatus.style.color = "#ff8a8a";
        nearestStatus.textContent = "Coordinates must be numbers.";
        return;
    }

    const nearest = findNearestLatticePoint(targetX, targetZ);
    const card = findCardByOffset(nearest.x, nearest.z);

    if (card) {
        activateTab("grid");
        highlightCard(card);
        nearestStatus.style.color = "#8a6fa8";
        nearestStatus.textContent = "Nearest portal is " + nearest.name + ".";
        return;
    }

    nearestStatus.style.color = "#ffd54a";
    nearestStatus.textContent = "Nearest portal (" + nearest.name + ") isn't in the current grid — it would sit at Overworld " +
        nearest.overworldX + ", " + nearest.overworldZ + ". Edit coordinates with a larger radius to include it.";
});

// --- Tool 3: Distance calculator (any two points) -----------------------

const distX1 = document.getElementById("distX1");
const distZ1 = document.getElementById("distZ1");
const distX2 = document.getElementById("distX2");
const distZ2 = document.getElementById("distZ2");
const distBtn = document.getElementById("distBtn");
const distStatus = document.getElementById("distStatus");
const distResult = document.getElementById("distResult");

distBtn.addEventListener("click", function () {
    distStatus.textContent = "";
    distResult.innerHTML = "";

    const rawValues = [distX1.value.trim(), distZ1.value.trim(), distX2.value.trim(), distZ2.value.trim()];

    if (rawValues.some(function (v) { return v === ""; })) {
        distStatus.style.color = "#ff8a8a";
        distStatus.textContent = "Fill in both points' X and Z.";
        return;
    }

    const numericValues = rawValues.map(Number);

    if (numericValues.some(Number.isNaN)) {
        distStatus.style.color = "#ff8a8a";
        distStatus.textContent = "Coordinates must be numbers.";
        return;
    }

    const [x1, z1, x2, z2] = numericValues;

    const overworldDistance = Math.round(Math.sqrt((x2 - x1) * (x2 - x1) + (z2 - z1) * (z2 - z1)));
    const netherDistance = Math.round(overworldDistance / 8);

    distResult.innerHTML =
        "Overworld distance: " + overworldDistance + " blocks<br>" +
        "Nether distance: ≈" + netherDistance + " blocks";
});

// --- Tool 5: Nearest buildable portal slot (works even off-grid) -------

const slotXInput = document.getElementById("slotX");
const slotZInput = document.getElementById("slotZ");
const slotBtn = document.getElementById("slotBtn");
const slotStatus = document.getElementById("slotStatus");
const slotResult = document.getElementById("slotResult");

slotBtn.addEventListener("click", function () {
    slotStatus.textContent = "";
    slotResult.innerHTML = "";

    if (motherAnchor === null) {
        slotStatus.style.color = "#ff8a8a";
        slotStatus.textContent = "Generate a grid first so there's a Mother Portal to measure from.";
        return;
    }

    const xVal = slotXInput.value.trim();
    const zVal = slotZInput.value.trim();

    if (xVal === "" || zVal === "") {
        slotStatus.style.color = "#ff8a8a";
        slotStatus.textContent = "Enter both an Overworld X and Z.";
        return;
    }

    const targetX = Number(xVal);
    const targetZ = Number(zVal);

    if (Number.isNaN(targetX) || Number.isNaN(targetZ)) {
        slotStatus.style.color = "#ff8a8a";
        slotStatus.textContent = "Coordinates must be numbers.";
        return;
    }

    const nearest = findNearestLatticePoint(targetX, targetZ);

    const dx = targetX - nearest.overworldX;
    const dz = targetZ - nearest.overworldZ;
    const distanceBlocks = Math.round(Math.sqrt(dx * dx + dz * dz));

    slotResult.innerHTML =
        "<strong>" + nearest.name + "</strong><br>" +
        "Overworld: " + nearest.overworldX + ", " + nearest.overworldZ + "<br>" +
        "Nether: " + nearest.netherX + ", " + nearest.netherZ + "<br>" +
        "≈" + distanceBlocks + " Overworld blocks from what you typed";
});

// --- Tool 6: Save / Load (shareable codes) -----------------------------
// Manual, session-scoped: a code is text you copy out and paste back in
// yourself — nothing is auto-saved or stored in the browser.

function encodeState(stateObj) {
    const json = JSON.stringify(stateObj);
    return btoa(unescape(encodeURIComponent(json)));
}

function decodeState(code) {
    const json = decodeURIComponent(escape(atob(code)));
    return JSON.parse(json);
}

const exportBtn = document.getElementById("exportBtn");
const exportOutput = document.getElementById("exportOutput");
const exportCopyBtn = document.getElementById("exportCopyBtn");
const exportStatus = document.getElementById("exportStatus");

const importInput = document.getElementById("importInput");
const importBtn = document.getElementById("importBtn");
const importStatus = document.getElementById("importStatus");

exportBtn.addEventListener("click", function () {
    exportStatus.textContent = "";

    if (motherAnchor === null) {
        exportStatus.style.color = "#ff8a8a";
        exportStatus.textContent = "Generate a grid first.";
        return;
    }

    const state = {
        overworldX: motherAnchor.overworldX,
        overworldZ: motherAnchor.overworldZ,
        radius: motherAnchor.radius,
        customNames: customNames,
        portalCategories: portalCategories,
        portalStatuses: portalStatuses,
        portalNotes: portalNotes
    };

    exportOutput.value = encodeState(state);
    exportStatus.style.color = "#8a6fa8";
    exportStatus.textContent = "Code generated below.";
});

exportCopyBtn.addEventListener("click", function () {
    if (exportOutput.value === "") {
        return;
    }
    navigator.clipboard.writeText(exportOutput.value)
        .then(function () {
            exportStatus.style.color = "#8a6fa8";
            exportStatus.textContent = "Copied to clipboard.";
        })
        .catch(function () {
            exportStatus.style.color = "#ff8a8a";
            exportStatus.textContent = "Couldn't copy — select and copy manually.";
        });
});

importBtn.addEventListener("click", async function () {
    importStatus.textContent = "";

    const code = importInput.value.trim();
    if (code === "") {
        importStatus.style.color = "#ff8a8a";
        importStatus.textContent = "Paste a code first.";
        return;
    }

    let data;
    try {
        data = decodeState(code);
    } catch (err) {
        importStatus.style.color = "#ff8a8a";
        importStatus.textContent = "That code isn't valid.";
        return;
    }

    if (typeof data.overworldX !== "number" || typeof data.overworldZ !== "number" || typeof data.radius !== "number") {
        importStatus.style.color = "#ff8a8a";
        importStatus.textContent = "That code is missing required data.";
        return;
    }

    resetGridState();

    motherXInput.value = data.overworldX;
    motherZInput.value = data.overworldZ;
    radiusField.value = data.radius;

    const success = await runGenerateSequence(data.overworldX, data.overworldZ, data.radius);

    if (!success) {
        importStatus.style.color = "#ff8a8a";
        importStatus.textContent = "Failed to rebuild the grid from that code.";
        return;
    }

    customNames = data.customNames || {};
    portalCategories = data.portalCategories || {};
    portalStatuses = data.portalStatuses || {};
    portalNotes = data.portalNotes || {};

    Array.from(document.querySelectorAll(".portal-card")).forEach(function (card) {
        refreshCardName(card);
        refreshCardCategory(card);
        refreshCardDetails(card);
    });

    activateTab("save");
    importStatus.style.color = "#8a6fa8";
    importStatus.textContent = "Loaded successfully.";
});
