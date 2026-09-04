const firebaseConfig = window.firebaseConfig;
let initializeApp;
let addDoc;
let collection;
let deleteDoc;
let doc;
let getDocs;
let getFirestore;
let onSnapshot;
let orderBy;
let query;
let setDoc;
let updateDoc;
let writeBatch;

const DEFAULT_ITEMS = [
  {
    title: "App Download",
    description: "",
    order: 1,
    images: [],
    type: "download",
    iosUrl: "https://apps.apple.com/kr/app/%EC%8A%A4%ED%91%BC%EC%9E%89%EA%B8%80%EB%A6%AC%EC%89%AC/id6755587378",
    androidUrl: "https://play.google.com/store/apps/details?id=com.tutee.spoon"
  },
  { title: "계량스푼 신청하기", description: "", order: 2, images: [] },
  { title: "튜터링 상품 구매하기", description: "", order: 3, images: [] },
  { title: "튜터 매칭", description: "", order: 4, images: [] },
  { title: "일정확인", description: "", order: 5, images: [] },
  { title: "일정변경", description: "", order: 6, images: [] },
  { title: "나의 수업내용 확인", description: "", order: 7, images: [] },
  { title: "수업 연장하기 (수강권 재구매)", description: "", order: 8, images: [] },
  { title: "문의하기 / 수강영수증", description: "", order: 9, images: [] },
  { title: "커뮤니티", description: "", order: 10, images: [] }
];

const list = document.getElementById("manual-list");
const adminBar = document.getElementById("admin-bar");
const adminToggle = document.getElementById("admin-toggle");
const status = document.getElementById("firebase-status");
const addButton = document.getElementById("add-item");
const isDesktop = () => window.matchMedia("(min-width: 769px)").matches;
const canEdit = () => isDesktop() && adminMode;
const isPinnedItem = (item) =>
  item?.type === "download" || /^app\s*download$/i.test(item?.title || "");
const isConfigured = firebaseConfig.apiKey !== "REPLACE_ME" &&
  firebaseConfig.projectId !== "REPLACE_ME";
const LOCAL_STORAGE_KEY = "spoon-manual-items";

let db;
let items = [];
let extraImages = [];
let draggedId = null;
let adminMode = false;
let openItemId = null;
let firebaseReady = false;
let keepPasteFocus = false;
const PASTE_HINT = "사진을 계속 붙여넣으면 아래에 차례로 추가됩니다 (Ctrl+V)\n또는 아래 버튼으로 사진 파일을 선택하세요";

function loadLocalItems() {
  try {
    const saved = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY));
    if (Array.isArray(saved) && saved.length) return saved;
  } catch (error) {
    console.warn("임시 저장 데이터를 불러오지 못했습니다.", error);
  }
  return DEFAULT_ITEMS.map((item, index) => ({
    ...item,
    id: `local-${index + 1}`
  }));
}

function saveLocalItems(nextItems) {
  items = nextItems.map((item, index) => ({ ...item, order: index + 1 }));
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
  render();
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.style.display = "block";
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.style.display = "none";
  }, 2200);
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function makeButton(text, action, danger = false) {
  const button = el("button", `edit-button${danger ? " danger" : ""}`, text);
  button.type = "button";
  button.addEventListener("click", action);
  return button;
}

function render() {
  list.replaceChildren();

  if (!items.length) {
    list.appendChild(el("p", "empty-message", "등록된 매뉴얼이 없습니다."));
    return;
  }

  const displayItems = [
    ...items.filter(isPinnedItem),
    ...items.filter(item => !isPinnedItem(item))
  ];

  displayItems.forEach((item, index) => {
    const pinned = isPinnedItem(item);
    const wrapper = el("div", pinned ? "accordion-item pinned" : "accordion-item");
    wrapper.dataset.id = item.id || "";
    const header = el(pinned ? "div" : "button", "accordion-header");
    if (!pinned) header.type = "button";
    header.append(el("span", "num", String(index + 1)), document.createTextNode(item.title));
    if (canEdit() && !pinned) {
      const dragHandle = el("span", "drag-handle", "↕ 드래그");
      dragHandle.draggable = true;
      dragHandle.title = "끌어서 목록 순서 변경";
      header.appendChild(dragHandle);
      setupDragAndDrop(wrapper, dragHandle, item.id);
    }

    const content = el("div", "accordion-content");
    const inner = el("div", "accordion-inner");

    if (pinned) {
      const downloads = el("div", "download-buttons");
      const ios = el("a", "action-button", "iOS 다운로드");
      const android = el("a", "action-button", "Android 다운로드");
      [ios, android].forEach(link => {
        link.target = "_blank";
        link.rel = "noopener noreferrer";
      });
      ios.href = item.iosUrl || "#";
      android.href = item.androidUrl || "#";
      downloads.append(ios, android);
      inner.appendChild(downloads);
    }

    getItemImages(item).forEach((image, imageIndex) => {
      const imageWrap = el("div", "manual-image-wrap");
      const img = el("img", "manual-image");
      img.src = image.url;
      img.alt = `${item.title} ${imageIndex + 1}`;
      img.loading = "lazy";
      imageWrap.appendChild(img);

      if (canEdit() && !pinned) {
        img.classList.add("editable-image");
        img.title = "클릭해서 이미지 삭제";
        img.addEventListener("click", event => {
          event.stopPropagation();
          removeImageFromItem(item, imageIndex);
        });
      }
      inner.appendChild(imageWrap);
    });

    if (canEdit() && !pinned) {
      inner.append(createImagePicker(item), createEditor(item));
    }

    content.appendChild(inner);
    wrapper.append(header, content);
    if (pinned || item.id === openItemId) {
      wrapper.classList.add("open");
      content.classList.add("active");
    }
    if (!pinned) {
      header.addEventListener("click", () => toggleAccordion(wrapper, content));
    }
    list.appendChild(wrapper);
  });

  if (keepPasteFocus && openItemId) {
    requestAnimationFrame(() => {
      const zone = list.querySelector(`[data-id="${CSS.escape(openItemId)}"] .image-paste-zone`);
      zone?.focus();
    });
  }
}

function setupDragAndDrop(wrapper, dragHandle, itemId) {
  dragHandle.addEventListener("click", event => event.stopPropagation());
  dragHandle.addEventListener("dragstart", event => {
    draggedId = itemId;
    wrapper.classList.add("dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", itemId);
  });
  wrapper.addEventListener("dragover", event => {
    if (!canEdit() || !draggedId || draggedId === itemId) return;
    if (isPinnedItem(items.find(item => item.id === itemId))) return;
    event.preventDefault();
    const dragged = list.querySelector(`[data-id="${CSS.escape(draggedId)}"]`);
    if (!dragged) return;
    const rect = wrapper.getBoundingClientRect();
    const insertBefore = event.clientY < rect.top + rect.height / 2;
    list.insertBefore(dragged, insertBefore ? wrapper : wrapper.nextSibling);
  });
  wrapper.addEventListener("drop", async event => {
    event.preventDefault();
    await saveDraggedOrder();
  });
  dragHandle.addEventListener("dragend", () => {
    wrapper.classList.remove("dragging");
    draggedId = null;
  });
}

async function saveDraggedOrder() {
  if (!canEdit() || !draggedId) return;
  const pinnedIds = items.filter(isPinnedItem).map(item => item.id);
  const orderedIds = [
    ...pinnedIds,
    ...[...list.querySelectorAll(".accordion-item")]
      .map(node => node.dataset.id)
      .filter(id => id && !pinnedIds.includes(id))
  ];
  if (!canUseFirebase()) {
    const byId = new Map(items.map(item => [item.id, item]));
    saveLocalItems(orderedIds.map(id => byId.get(id)).filter(Boolean));
    showToast("목록 순서를 변경했습니다.");
    return;
  }
  const batch = writeBatch(db);
  orderedIds.forEach((id, index) => {
    batch.update(doc(db, "manualItems", id), { order: index + 1 });
  });
  try {
    await batch.commit();
    showToast("목록 순서를 변경했습니다.");
  } catch (error) {
    console.error(error);
    showToast("순서 변경에 실패했습니다.");
    render();
  }
}

function toggleAccordion(selectedItem, selectedContent) {
  if (selectedItem.classList.contains("pinned")) return;
  const wasOpen = selectedContent.classList.contains("active");
  document.querySelectorAll(".accordion-item").forEach(node => {
    if (node.classList.contains("pinned")) return;
    node.classList.remove("open");
    node.querySelector(".accordion-content")?.classList.remove("active");
  });
  openItemId = null;
  if (!wasOpen) {
    selectedContent.classList.add("active");
    selectedItem.classList.add("open");
    openItemId = selectedItem.dataset.id;
  }
}

function createEditor(item) {
  const editor = el("div", "item-editor");

  editor.append(
    makeButton("제목 수정", () => editItem(item)),
    makeButton("목록 삭제", () => removeItem(item), true)
  );
  return editor;
}

function createImagePicker(item) {
  const count = getItemImages(item).length;
  const pasteZone = el("div", "image-paste-zone", count
    ? `현재 사진 ${count}장\n${PASTE_HINT}`
    : PASTE_HINT);
  pasteZone.tabIndex = 0;
  pasteZone.contentEditable = "true";
  pasteZone.setAttribute("role", "button");
  pasteZone.setAttribute("aria-label", `${item.title} 캡처 이미지 붙여넣기`);

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/*";
  fileInput.multiple = true;
  fileInput.hidden = true;

  const fileButton = el("button", "file-pick-button", "사진 파일 선택");
  fileButton.type = "button";

  const handleFiles = files => {
    if (files.length) uploadImages(item.id, files);
  };

  pasteZone.addEventListener("click", event => {
    event.stopPropagation();
    pasteZone.focus();
  });
  pasteZone.addEventListener("keydown", event => {
    if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "v") {
      event.preventDefault();
    }
  });
  pasteZone.addEventListener("paste", event => {
    const files = getClipboardImageFiles(event.clipboardData);
    event.preventDefault();
    event.stopPropagation();
    pasteZone.textContent = count ? `현재 사진 ${count}장\n${PASTE_HINT}` : PASTE_HINT;
    if (!files.length) {
      showToast("클립보드에 이미지가 없습니다. '사진 파일 선택'을 이용해 주세요.");
      return;
    }
    handleFiles(files);
  });
  ["dragenter", "dragover"].forEach(type => {
    pasteZone.addEventListener(type, event => {
      event.preventDefault();
      event.stopPropagation();
      pasteZone.classList.add("dragover");
    });
  });
  pasteZone.addEventListener("dragleave", () => pasteZone.classList.remove("dragover"));
  pasteZone.addEventListener("drop", event => {
    event.preventDefault();
    event.stopPropagation();
    pasteZone.classList.remove("dragover");
    const files = [...(event.dataTransfer?.files || [])].filter(file => file.type.startsWith("image/"));
    handleFiles(files);
  });
  fileButton.addEventListener("click", event => {
    event.stopPropagation();
    fileInput.click();
  });
  fileInput.addEventListener("change", () => {
    handleFiles([...fileInput.files]);
    fileInput.value = "";
  });

  const wrap = el("div");
  wrap.append(pasteZone, fileInput, fileButton);
  return wrap;
}

function canUseFirebase() {
  return isConfigured && firebaseReady && db;
}

function getItemImages(item) {
  const stored = (item.images || []).filter(image => image?.url);
  const extra = extraImages.filter(image => image.itemId === item.id);
  return [...stored, ...extra];
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      const maxWidth = 720;
      const scale = Math.min(1, maxWidth / image.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#FFFBF7";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(objectUrl);
      let quality = 0.72;
      let dataUrl = canvas.toDataURL("image/jpeg", quality);
      while (dataUrl.length > 900000 && quality > 0.4) {
        quality -= 0.08;
        dataUrl = canvas.toDataURL("image/jpeg", quality);
      }
      resolve(dataUrl);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("이미지를 읽지 못했습니다."));
    };
    image.src = objectUrl;
  });
}

function getClipboardImageFiles(clipboardData) {
  const fromItems = [...(clipboardData?.items || [])]
    .filter(clipboardItem => clipboardItem.type.startsWith("image/"))
    .map((clipboardItem, index) => {
      const blob = clipboardItem.getAsFile
        ? clipboardItem.getAsFile()
        : clipboardItem;
      if (!blob) return null;
      const extension = blob.type.split("/")[1] || "png";
      return new File(
        [blob],
        blob.name || `clipboard-${Date.now()}-${index + 1}.${extension}`,
        { type: blob.type }
      );
    })
    .filter(Boolean);
  if (fromItems.length) return fromItems;
  return [...(clipboardData?.files || [])].filter(file => file.type.startsWith("image/"));
}

async function editItem(item) {
  if (!canEdit() || isPinnedItem(item)) return;
  const title = prompt("목록 제목", item.title);
  if (title === null || !title.trim()) return;
  const changes = { title: title.trim() };

  if (!canUseFirebase()) {
    saveLocalItems(items.map(current =>
      current.id === item.id ? { ...current, ...changes } : current
    ));
    showToast("수정했습니다.");
    return;
  }
  await updateDoc(doc(db, "manualItems", item.id), changes);
  showToast("수정했습니다.");
}

async function uploadImages(itemId, files) {
  const item = items.find(current => current.id === itemId);
  if (!canEdit() || !item || isPinnedItem(item) || !files.length) return;
  openItemId = itemId;
  keepPasteFocus = true;
  showToast("이미지를 저장하고 있습니다.");
  try {
    const uploaded = [];
    for (const file of files) {
      uploaded.push({
        url: await compressImage(file),
        name: file.name || `capture-${Date.now()}.jpg`
      });
    }
    if (!canUseFirebase()) {
      saveLocalItems(items.map(current =>
        current.id === itemId
          ? { ...current, images: [...(current.images || []), ...uploaded] }
          : current
      ));
      showToast(`사진을 ${uploaded.length}장 추가했습니다. 같은 목록에 계속 붙여넣으세요.`);
      return;
    }
    for (let index = 0; index < uploaded.length; index += 1) {
      const image = uploaded[index];
      const createdAt = Date.now() + index;
      const saved = await addDoc(collection(db, "manualImages"), {
        itemId,
        url: image.url,
        name: image.name,
        createdAt
      });
      extraImages = extraImages.some(current => current.id === saved.id)
        ? extraImages
        : [...extraImages, {
          id: saved.id,
          itemId,
          url: image.url,
          name: image.name,
          createdAt
        }];
      render();
    }
    showToast(`사진을 ${uploaded.length}장 추가했습니다. 같은 목록에 계속 붙여넣으세요.`);
  } catch (error) {
    console.error(error);
    showToast(error?.message ? `저장 실패: ${error.message}` : "이미지 저장에 실패했습니다.");
  }
}

async function removeImageFromItem(item, imageIndex) {
  if (!canEdit() || isPinnedItem(item) || !confirm("이 이미지를 삭제할까요?")) return;
  const image = getItemImages(item)[imageIndex];
  try {
    if (!canUseFirebase()) {
      saveLocalItems(items.map(current =>
        current.id === item.id
          ? { ...current, images: (current.images || []).filter((_, index) => index !== imageIndex) }
          : current
      ));
      showToast("이미지를 삭제했습니다.");
      return;
    }
    if (image.id && extraImages.some(current => current.id === image.id)) {
      await deleteDoc(doc(db, "manualImages", image.id));
    } else {
      const stored = (item.images || []).filter(current => current !== image && current.url !== image.url);
      await updateDoc(doc(db, "manualItems", item.id), { images: stored });
    }
    showToast("이미지를 삭제했습니다.");
  } catch (error) {
    console.error(error);
    showToast("이미지 삭제에 실패했습니다.");
  }
}

async function removeItem(item) {
  if (!canEdit() || isPinnedItem(item) || !confirm(`"${item.title}" 목록을 삭제할까요?`)) return;
  try {
    if (!canUseFirebase()) {
      saveLocalItems(items.filter(current => current.id !== item.id));
      showToast("목록을 삭제했습니다.");
      return;
    }
    const related = extraImages.filter(image => image.itemId === item.id);
    await Promise.all(related.map(image => deleteDoc(doc(db, "manualImages", image.id))));
    await deleteDoc(doc(db, "manualItems", item.id));
    showToast("목록을 삭제했습니다.");
  } catch (error) {
    console.error(error);
    showToast("목록 삭제에 실패했습니다.");
  }
}

async function addItem() {
  if (!canEdit()) return;
  const title = prompt("새 목록 제목");
  if (!title || !title.trim()) return;
  if (!canUseFirebase()) {
    saveLocalItems([
      ...items,
      {
        id: `local-${Date.now()}`,
        title: title.trim(),
        description: "",
        images: [],
        order: items.length + 1,
        type: "manual"
      }
    ]);
    showToast("목록을 추가했습니다.");
    return;
  }
  await addDoc(collection(db, "manualItems"), {
    title: title.trim(),
    description: "",
    images: [],
    order: items.length ? Math.max(...items.map(item => item.order)) + 1 : 1,
    type: "manual"
  });
  showToast("목록을 추가했습니다.");
}

async function seedDefaults() {
  const snapshot = await getDocs(collection(db, "manualItems"));
  if (!snapshot.empty || !isDesktop()) return;
  await Promise.all(DEFAULT_ITEMS.map((item, index) =>
    setDoc(doc(db, "manualItems", `default-${index + 1}`), item)
  ));
}

async function loadFirebase() {
  const [appModule, firestoreModule] = await Promise.all([
    import("https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js")
  ]);
  ({ initializeApp } = appModule);
  ({
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDocs,
    getFirestore,
    onSnapshot,
    orderBy,
    query,
    setDoc,
    updateDoc,
    writeBatch
  } = firestoreModule);
}

function startFirebase() {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);

  seedDefaults().catch(error => {
    console.error(error);
    status.textContent = "Firebase 권한 설정을 확인해 주세요. Firestore 규칙을 다시 게시해 주세요.";
  });

  onSnapshot(
    query(collection(db, "manualItems"), orderBy("order")),
    snapshot => {
      firebaseReady = true;
      items = snapshot.docs.map(document => ({ id: document.id, ...document.data() }));
      status.textContent = isDesktop() ? "PC 편집 모드" : "";
      render();
    },
    error => {
      console.error(error);
      firebaseReady = false;
      status.textContent = "Firebase 연결 또는 권한 설정을 확인해 주세요.";
      items = loadLocalItems();
      render();
    }
  );

  onSnapshot(
    collection(db, "manualImages"),
    snapshot => {
      extraImages = snapshot.docs
        .map(document => ({ id: document.id, ...document.data() }))
        .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      render();
    },
    error => {
      console.error(error);
    }
  );
}

addButton.addEventListener("click", addItem);
document.addEventListener("paste", event => {
  const files = getClipboardImageFiles(event.clipboardData);
  if (!files.length) return;
  if (event.target.closest?.(".image-paste-zone")) return;
  if (!isDesktop()) return;
  if (!adminMode) {
    showToast("먼저 오른쪽 위 '관리자'를 눌러 주세요.");
    return;
  }
  if (!openItemId) {
    showToast("사진을 넣을 목록을 먼저 열어 주세요.");
    return;
  }
  const item = items.find(current => current.id === openItemId);
  if (!item || isPinnedItem(item)) return;
  event.preventDefault();
  uploadImages(openItemId, files);
});
adminToggle.addEventListener("click", () => {
  if (!isDesktop()) return;
  adminMode = !adminMode;
  adminBar.hidden = !adminMode;
  adminToggle.textContent = adminMode ? "관리 종료" : "관리자";
  render();
});

if (isConfigured) {
  loadFirebase()
    .then(startFirebase)
    .catch(error => {
      console.error(error);
      items = loadLocalItems();
      status.textContent = isDesktop() ? "PC 편집 모드 (브라우저 임시 저장)" : "";
      render();
    });
} else {
  items = loadLocalItems();
  status.textContent = isDesktop()
    ? "PC 편집 모드 (Firebase 연결 전: 이 브라우저에 임시 저장)"
    : "";
  render();
}

window.matchMedia("(min-width: 769px)").addEventListener("change", () => {
  if (!isDesktop()) adminMode = false;
  adminToggle.hidden = !isDesktop();
  adminBar.hidden = !canEdit();
  adminToggle.textContent = "관리자";
  status.textContent = isDesktop()
    ? (isConfigured ? "PC 편집 모드" : "PC 편집 모드 (Firebase 연결 전: 이 브라우저에 임시 저장)")
    : "";
  render();
});
