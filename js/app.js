const KEY = 'notemap-v1.7-recovery';
const FILE_FORMAT = 'notemap';
const FILE_VERSION = 1;
const colors = ['#8b5cf6','#ec4899','#3b82f6','#10b981','#f59e0b','#f97316','#64748b'];

const sample = {
  nodes: [
    {id:'n1',x:420,y:120,title:'1. Mục tiêu NoteMap',content:'• Ghi chú nhanh trên canvas\n• Nối các note theo mối quan hệ\n• Sắp xếp ý tưởng trực quan',tag:'Quan trọng',color:'#ec4899'},
    {id:'n2',x:390,y:360,title:'2. Tính năng chính',content:'• Tạo và kéo note tự do\n• 4 điểm nối độc lập\n• Zoom và pan canvas\n• Lưu tự động',tag:'Tính năng',color:'#3b82f6'},
    {id:'n3',x:700,y:590,title:'3. Công việc cần làm',content:'☐ Thêm group / frame\n☐ Thêm label cho dây nối\n☐ Thêm nhiều workspace\n☐ Đồng bộ dữ liệu cloud',tag:'Công việc',color:'#10b981'},
    {id:'n4',x:1040,y:120,title:'4. Tài liệu tham khảo',content:'• Ý tưởng giao diện\n• Tài liệu thiết kế mind-map\n• Mẫu workflow\n• Các note tham khảo',tag:'Tài liệu',color:'#f59e0b'},
    {id:'n5',x:1010,y:370,title:'5. Luồng ý tưởng',content:'Ý tưởng → Phân tích → Tạo note → Nối quan hệ → Hoàn thiện',tag:'Sơ đồ',color:'#8b5cf6'},
    {id:'n6',x:1005,y:610,title:'6. Ghi chú khác',content:'• Có thể thêm ảnh và file\n• Có thể thêm checklist\n• Có thể thêm chế độ focus',tag:'Ghi chú',color:'#f97316'}
  ],
  edges: [
    {id:'e1',source:'n1',sourceHandle:'b',target:'n2',targetHandle:'t'},
    {id:'e2',source:'n2',sourceHandle:'r',target:'n3',targetHandle:'t'},
    {id:'e3',source:'n1',sourceHandle:'r',target:'n4',targetHandle:'l'},
    {id:'e4',source:'n4',sourceHandle:'b',target:'n5',targetHandle:'t'},
    {id:'e5',source:'n5',sourceHandle:'b',target:'n6',targetHandle:'t'}
  ],
  trash: [],
  trashEdges: []
};

let state = blankState();
let currentProjectName = 'Dự án mới';
let currentFileName = null;
let fileDirty = false;
let selected = null;
let selectedEdge = null;
let zoom = 1;
let pan = {x:0,y:0};
let drag = null;
let linkStart = null;
let linkPointer = null;
let panning = null;
let editorLoadedNodeId = null;
let savedRichRange = null;
let activeView = 'overview';
let selectedTrash = new Set();

// Undo / Redo history. History snapshots keep large embedded image/file data in a
// shared in-memory asset pool so Ctrl+Z/Ctrl+Y do not duplicate the same Base64
// attachment in every history entry.
const HISTORY_LIMIT = 80;
const HISTORY_COALESCE_MS = 900;
let undoStack = [];
let redoStack = [];
let historyCurrent = null;
let historyApplying = false;
let historyLastGroup = null;
let historyLastAt = 0;
let historyAssetSeq = 0;
const historyAssetPool = new Map();
const historyAssetIndex = new Map();

const canvas = document.getElementById('canvas');
const world = document.getElementById('world');
const nodesEl = document.getElementById('nodes');
const svg = document.getElementById('svg');
const titleInput = document.getElementById('titleInput');
const richEditor = document.getElementById('richEditor');
const richToolbar = document.getElementById('richToolbar');
const rgbR = document.getElementById('rgbR');
const rgbG = document.getElementById('rgbG');
const rgbB = document.getElementById('rgbB');
const rgbPreview = document.getElementById('rgbPreview');
const hexColor = document.getElementById('hexColor');
const noteColorPicker = document.getElementById('noteColorPicker');
const tagInput = document.getElementById('tagInput');
const searchInput = document.getElementById('search');
const appBody = document.querySelector('.body');
const allNotesView = document.getElementById('allNotesView');
const trashView = document.getElementById('trashView');
const notesTableBody = document.getElementById('notesTableBody');
const trashTableBody = document.getElementById('trashTableBody');
const notesEmpty = document.getElementById('notesEmpty');
const trashEmpty = document.getElementById('trashEmpty');
const notesCount = document.getElementById('notesCount');
const trashCount = document.getElementById('trashCount');
const restoreSelectedBtn = document.getElementById('restoreSelectedBtn');
const trashSelectionInfo = document.getElementById('trashSelectionInfo');
const landingScreen = document.getElementById('landingScreen');
const workspaceApp = document.getElementById('workspaceApp');
const projectFileInput = document.getElementById('projectFileInput');
const projectNameEl = document.getElementById('projectName');
const saveStatusEl = document.getElementById('saveStatus');
const saveFileBtn = document.getElementById('saveFileBtn');
const homeBtn = document.getElementById('homeBtn');
const newProjectBtn = document.getElementById('newProjectBtn');
const openProjectBtn = document.getElementById('openProjectBtn');
const imageBtn = document.getElementById('imageBtn');
const imageFileInput = document.getElementById('imageFileInput');
const attachmentBtn = document.getElementById('attachmentBtn');
const attachmentFileInput = document.getElementById('attachmentFileInput');
const imageEditorModal = document.getElementById('imageEditorModal');
const imageEditorCanvas = document.getElementById('imageEditorCanvas');
const imageEditorStage = document.getElementById('imageEditorStage');
const imageEditorFileName = document.getElementById('imageEditorFileName');
const imageStrokeColor = document.getElementById('imageStrokeColor');
const imageStrokeHex = document.getElementById('imageStrokeHex');
const imageStrokeWidth = document.getElementById('imageStrokeWidth');
const imageStrokeWidthValue = document.getElementById('imageStrokeWidthValue');
const imageOpacity = document.getElementById('imageOpacity');
const imageOpacityValue = document.getElementById('imageOpacityValue');
const imageFillOpacity = document.getElementById('imageFillOpacity');
const imageFillOpacityValue = document.getElementById('imageFillOpacityValue');
const imageSelectedLabel = document.getElementById('imageSelectedLabel');
const imageDeleteSelected = document.getElementById('imageDeleteSelected');
const imageEditUndoBtn = document.getElementById('imageEditUndo');
const imageEditRedoBtn = document.getElementById('imageEditRedo');
const imageZoomLabel = document.getElementById('imageZoomLabel');


function blankState(){
  return {nodes:[], edges:[], trash:[], trashEdges:[]};
}

function cloneSample(){
  return JSON.parse(JSON.stringify(sample));
}

function normalizeState(value){
  const base = value && Array.isArray(value.nodes) && Array.isArray(value.edges) ? value : cloneSample();
  if(!Array.isArray(base.trash)) base.trash = [];
  if(!Array.isArray(base.trashEdges)) base.trashEdges = [];
  return base;
}

function loadState(){
  // File .notemap is the source of truth. localStorage is only an emergency recovery cache.
  try{
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if(saved && Array.isArray(saved.nodes) && Array.isArray(saved.edges)) return normalizeState(saved);
  }catch(err){
    console.warn('Không đọc được bản recovery:', err);
  }
  return blankState();
}

function historyTokenizeString(value){
  if(typeof value !== 'string' || !value.includes('data:')) return value;
  return value.replace(/data:[^,]+;base64,[A-Za-z0-9+/=]+/g, asset => {
    let token = historyAssetIndex.get(asset);
    if(!token){
      token = `__NM_HISTORY_ASSET_${++historyAssetSeq}__`;
      historyAssetIndex.set(asset, token);
      historyAssetPool.set(token, asset);
    }
    return token;
  });
}

function historyEncodeValue(value){
  if(typeof value === 'string') return historyTokenizeString(value);
  if(Array.isArray(value)) return value.map(historyEncodeValue);
  if(value && typeof value === 'object'){
    const out = {};
    for(const [key, item] of Object.entries(value)) out[key] = historyEncodeValue(item);
    return out;
  }
  return value;
}

function historyDecodeValue(value){
  if(typeof value === 'string'){
    return value.replace(/__NM_HISTORY_ASSET_\d+__/g, token => historyAssetPool.get(token) || token);
  }
  if(Array.isArray(value)) return value.map(historyDecodeValue);
  if(value && typeof value === 'object'){
    const out = {};
    for(const [key, item] of Object.entries(value)) out[key] = historyDecodeValue(item);
    return out;
  }
  return value;
}

function makeHistorySnapshot(){
  return JSON.stringify(historyEncodeValue(state));
}

function restoreHistorySnapshot(snapshot){
  const decoded = historyDecodeValue(JSON.parse(snapshot));
  state = normalizeState(decoded);
}

function historyGroupKey(){
  const el = document.activeElement;
  if(el === titleInput) return selected ? `typing:title:${selected}` : null;
  if(el === tagInput) return selected ? `typing:tag:${selected}` : null;
  if(el === richEditor || (el && richEditor.contains(el))) return selected ? `typing:rich:${selected}` : null;
  if([rgbR,rgbG,rgbB,hexColor,noteColorPicker].includes(el)) return selected ? `color:${selected}` : null;
  return null;
}

function resetHistory(){
  undoStack = [];
  redoStack = [];
  historyAssetPool.clear();
  historyAssetIndex.clear();
  historyAssetSeq = 0;
  historyLastGroup = null;
  historyLastAt = 0;
  historyCurrent = makeHistorySnapshot();
}

function recordHistoryPoint(){
  if(historyApplying) return;
  const next = makeHistorySnapshot();
  if(historyCurrent === null){
    historyCurrent = next;
    return;
  }
  if(next === historyCurrent) return;

  const now = Date.now();
  const group = historyGroupKey();
  const canCoalesce = !!group && group === historyLastGroup && (now - historyLastAt) <= HISTORY_COALESCE_MS;

  if(!canCoalesce){
    undoStack.push(historyCurrent);
    if(undoStack.length > HISTORY_LIMIT) undoStack.shift();
  }

  historyCurrent = next;
  redoStack = [];
  historyLastGroup = group;
  historyLastAt = now;
}

function finishHistoryRestore(){
  // Drop selections that no longer exist after history navigation.
  if(selected && !nodeBy(selected)) selected = null;
  if(selectedEdge && !edgeBy(selectedEdge)) selectedEdge = null;
  selectedTrash.clear();
  editorLoadedNodeId = null;
  savedRichRange = null;
  drag = null;
  linkStart = null;
  linkPointer = null;
  document.body.classList.remove('is-linking');
  persistRecovery();
  markDirty();
  render();
  if(activeView === 'notes') renderAllNotes();
  if(activeView === 'trash') renderTrash();
}

function undoHistory(){
  if(!undoStack.length || historyCurrent === null) return false;
  historyApplying = true;
  try{
    redoStack.push(historyCurrent);
    const previous = undoStack.pop();
    restoreHistorySnapshot(previous);
    historyCurrent = previous;
    historyLastGroup = null;
    historyLastAt = 0;
    finishHistoryRestore();
    return true;
  }finally{
    historyApplying = false;
  }
}

function redoHistory(){
  if(!redoStack.length || historyCurrent === null) return false;
  historyApplying = true;
  try{
    undoStack.push(historyCurrent);
    if(undoStack.length > HISTORY_LIMIT) undoStack.shift();
    const next = redoStack.pop();
    restoreHistorySnapshot(next);
    historyCurrent = next;
    historyLastGroup = null;
    historyLastAt = 0;
    finishHistoryRestore();
    return true;
  }finally{
    historyApplying = false;
  }
}

function persistRecovery(){
  try{ localStorage.setItem(KEY, JSON.stringify(state)); }catch(_){ }
}

function updateSaveStatus(text, cls='unsaved'){
  saveStatusEl.textContent = text;
  saveStatusEl.classList.remove('unsaved','saving','saved-file');
  saveStatusEl.classList.add(cls);
}

function markDirty(){
  fileDirty = true;
  updateSaveStatus('Có thay đổi • Ctrl+S', 'unsaved');
}

function save(){
  persistRecovery();
  recordHistoryPoint();
  markDirty();
}

function safeProjectName(name='Dự án mới'){
  return String(name || 'Dự án mới').replace(/[\\/:*?"<>|]+/g,'-').trim() || 'Dự án mới';
}

function stripNotemapExtension(name=''){
  return String(name).replace(/\.notemap$/i,'');
}

function projectDocument(nameOverride=currentProjectName){
  return {
    format: FILE_FORMAT,
    version: FILE_VERSION,
    app: 'NoteMap',
    project: {
      name: nameOverride,
      savedAt: new Date().toISOString()
    },
    data: normalizeState(JSON.parse(JSON.stringify(state))),
    view: {zoom, pan:{x:pan.x,y:pan.y}}
  };
}

function showLanding(){
  landingScreen.style.display = '';
  workspaceApp.style.display = 'none';
  document.body.classList.remove('is-linking');
}

function showWorkspace(){
  landingScreen.style.display = 'none';
  workspaceApp.style.display = 'grid';
  projectNameEl.textContent = currentProjectName;
  requestAnimationFrame(() => { applyTransform(); drawEdges(); });
}

function resetWorkspaceRuntime(){
  selected = null;
  selectedEdge = null;
  selectedTrash.clear();
  activeView = 'overview';
  zoom = 1;
  pan = {x:0,y:0};
  drag = null;
  linkStart = null;
  linkPointer = null;
  panning = null;
  editorLoadedNodeId = null;
  savedRichRange = null;
  searchInput.value = '';
}

function startNewProject(){
  state = blankState();
  currentProjectName = 'Dự án mới';
  currentFileName = null;
  fileDirty = false;
  resetWorkspaceRuntime();
  resetHistory();
  persistRecovery();
  updateSaveStatus('Chưa lưu file', 'unsaved');
  showWorkspace();
  render();
  setView('overview');
}

async function openProjectFile(file){
  try{
    const text = await file.text();
    const parsed = JSON.parse(text);
    let data;
    let savedView = null;
    let name = stripNotemapExtension(file.name);

    if(parsed && parsed.format === FILE_FORMAT && parsed.data){
      data = parsed.data;
      savedView = parsed.view || null;
      if(parsed.project && parsed.project.name) name = parsed.project.name;
    }else if(parsed && Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)){
      // Backward-compatible raw JSON project.
      data = parsed;
    }else{
      throw new Error('File không đúng định dạng NoteMap.');
    }

    state = normalizeState(data);
    currentProjectName = name || 'Dự án';
    currentFileName = file.name;
    fileDirty = false;
    resetWorkspaceRuntime();
    if(savedView && Number.isFinite(Number(savedView.zoom))) zoom = Math.min(2.2, Math.max(.35, Number(savedView.zoom)));
    if(savedView && savedView.pan && Number.isFinite(Number(savedView.pan.x)) && Number.isFinite(Number(savedView.pan.y))) pan = {x:Number(savedView.pan.x), y:Number(savedView.pan.y)};
    resetHistory();
    persistRecovery();
    updateSaveStatus('Đã mở file', 'saved-file');
    showWorkspace();
    render();
    setView('overview');
  }catch(err){
    alert('Không thể mở dự án: ' + (err?.message || 'File không hợp lệ.'));
  }finally{
    projectFileInput.value = '';
  }
}

async function saveProjectToDisk(){
  if(workspaceApp.style.display === 'none') return;
  updateSaveStatus('Đang lưu...', 'saving');
  const suggested = (currentFileName && currentFileName.toLowerCase().endsWith('.notemap'))
    ? currentFileName
    : `${safeProjectName(currentProjectName)}.notemap`;

  try{
    if('showSaveFilePicker' in window){
      // Ctrl+S intentionally opens the Save dialog every time, as requested.
      const handle = await window.showSaveFilePicker({
        suggestedName: suggested,
        types:[{description:'NoteMap Project', accept:{'application/json':['.notemap']}}]
      });
      const chosenFileName = handle.name || suggested;
      const chosenProjectName = stripNotemapExtension(chosenFileName) || currentProjectName;
      const text = JSON.stringify(projectDocument(chosenProjectName), null, 2);
      const blob = new Blob([text], {type:'application/json;charset=utf-8'});
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      currentFileName = chosenFileName;
      currentProjectName = chosenProjectName;
      projectNameEl.textContent = currentProjectName;
    }else{
      // Fallback: the browser downloads a .notemap file. Depending on browser settings,
      // it may ask for a location or use the configured Downloads folder.
      const text = JSON.stringify(projectDocument(currentProjectName), null, 2);
      const blob = new Blob([text], {type:'application/json;charset=utf-8'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = suggested;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      currentFileName = suggested;
    }
    fileDirty = false;
    persistRecovery();
    updateSaveStatus('Đã lưu file', 'saved-file');
  }catch(err){
    if(err?.name === 'AbortError'){
      updateSaveStatus(fileDirty ? 'Có thay đổi • Ctrl+S' : (currentFileName ? 'Đã mở file' : 'Chưa lưu file'), fileDirty ? 'unsaved' : (currentFileName ? 'saved-file' : 'unsaved'));
      return;
    }
    console.error(err);
    updateSaveStatus('Lưu thất bại', 'unsaved');
    alert('Không thể lưu file dự án. Hãy thử lại bằng Chrome hoặc Edge.');
  }
}


function nodeBy(id){
  return state.nodes.find(n => n.id === id);
}

function edgeBy(id){
  return state.edges.find(edge => edge.id === id);
}

function esc(s=''){
  return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}

function sanitizeHtml(html=''){
  const box = document.createElement('div');
  box.innerHTML = String(html);
  box.querySelectorAll('script,style,iframe,object,embed,meta,link').forEach(el => el.remove());
  box.querySelectorAll('*').forEach(el => {
    [...el.attributes].forEach(attr => {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim().toLowerCase();
      if(name.startsWith('on')) el.removeAttribute(attr.name);
      if((name === 'href' || name === 'src') && value.startsWith('javascript:')) el.removeAttribute(attr.name);
    });
  });
  return box.innerHTML;
}

function richContent(n){
  if(!n) return '';
  if(typeof n.contentHtml === 'string') return sanitizeHtml(n.contentHtml);
  return esc(n.content || '').replace(/\n/g,'<br>');
}

function plainContent(n){
  if(!n) return '';
  if(typeof n.content === 'string' && !n.contentHtml) return n.content;
  const box = document.createElement('div');
  box.innerHTML = richContent(n);
  box.querySelectorAll('.image-edit-btn,.image-remove-btn,.file-remove-btn,.image-annotation-overlay').forEach(el => el.remove());
  return box.innerText || box.textContent || '';
}

function refreshNodeVisual(id){
  const n = nodeBy(id);
  const el = nodesEl.querySelector(`.node[data-id="${CSS.escape(id)}"]`);
  if(!n || !el) return;
  el.style.borderColor = n.color;
  const dot = el.querySelector('.note-dot');
  if(dot) dot.style.background = n.color;
  const head = el.querySelector('.head');
  if(head){
    const dotHtml = `<span class="note-dot" style="background:${n.color}"></span>`;
    head.innerHTML = dotHtml + esc(n.title);
  }
  const body = el.querySelector('.bodytxt');
  if(body) body.innerHTML = richContent(n);
  el.classList.toggle('has-image', /<img\b/i.test(richContent(n)));
  const pill = el.querySelector('.pill');
  if(pill) pill.textContent = n.tag || 'Note';
  drawEdges();
  applySearchFilter();
}

function clampRgb(v){
  return Math.max(0, Math.min(255, Number.isFinite(Number(v)) ? Math.round(Number(v)) : 0));
}
function rgbToHex(r,g,b){
  return '#' + [r,g,b].map(v => clampRgb(v).toString(16).padStart(2,'0')).join('').toUpperCase();
}
function hexToRgb(hex){
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if(!m) return null;
  return {r:parseInt(m[1].slice(0,2),16),g:parseInt(m[1].slice(2,4),16),b:parseInt(m[1].slice(4,6),16)};
}
function updateRgbControls(color){
  const rgb = hexToRgb(color) || {r:139,g:92,b:246};
  rgbR.value = rgb.r; rgbG.value = rgb.g; rgbB.value = rgb.b;
  const hex = rgbToHex(rgb.r,rgb.g,rgb.b);
  rgbPreview.style.background = hex;
  hexColor.value = hex;
  noteColorPicker.value = hex.toLowerCase();
}
function applyNoteColor(hex){
  const n = nodeBy(selected);
  if(!n) return;
  const rgb = hexToRgb(hex);
  if(!rgb) return;
  n.color = rgbToHex(rgb.r,rgb.g,rgb.b).toLowerCase();
  updateRgbControls(n.color);
  save();
  refreshNodeVisual(n.id);
}

function handleName(handle){
  return ({l:'trái',r:'phải',t:'trên',b:'dưới'})[handle] || handle;
}

function formatDeletedAt(value){
  if(!value) return '—';
  try{
    return new Intl.DateTimeFormat('vi-VN', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(value));
  }catch(_){
    return '—';
  }
}

function noteSummary(n, max=110){
  const text = plainContent(n).replace(/\s+/g,' ').trim();
  return text.length > max ? text.slice(0,max-1) + '…' : text;
}

function setView(view){
  activeView = ['overview','notes','trash'].includes(view) ? view : 'overview';
  document.querySelectorAll('.view-nav').forEach(el => el.classList.toggle('active', el.dataset.view === activeView));
  canvas.style.display = activeView === 'overview' ? 'block' : 'none';
  allNotesView.classList.toggle('active', activeView === 'notes');
  trashView.classList.toggle('active', activeView === 'trash');
  appBody.classList.toggle('list-mode', activeView !== 'overview');
  if(activeView !== 'overview'){
    selected = null;
    selectedEdge = null;
  }
  if(activeView === 'notes') renderAllNotes();
  if(activeView === 'trash') renderTrash();
  updateNavCounts();
  syncEditor();
  if(activeView === 'overview') requestAnimationFrame(() => { applyTransform(); drawEdges(); });
}

function updateNavCounts(){
  notesCount.textContent = state.nodes.length;
  trashCount.textContent = state.trash.length;
}

function renderAllNotes(){
  if(!notesTableBody) return;
  const q = searchInput.value.toLowerCase().trim();
  const rows = state.nodes.filter(n => !q || (`${n.title} ${plainContent(n)} ${n.tag}`).toLowerCase().includes(q));
  notesTableBody.innerHTML = '';
  notesEmpty.style.display = rows.length ? 'none' : 'block';
  for(const n of rows){
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><div class="table-note-title"><span class="table-color-dot" style="background:${n.color}"></span><span>${esc(n.title)}</span></div></td>
      <td><span class="table-tag">${esc(n.tag || 'Note')}</span></td>
      <td class="table-summary">${esc(noteSummary(n))}</td>
      <td><span class="color-chip" style="background:${n.color}">${esc((n.color || '').toUpperCase())}</span></td>
      <td class="table-actions"><button class="mini-action open-note" type="button">Mở</button><button class="mini-action danger-soft delete-note" type="button">Xóa</button></td>
    `;
    tr.querySelector('.open-note').onclick = e => {
      e.stopPropagation();
      selected = n.id;
      selectedEdge = null;
      setView('overview');
      render();
    };
    tr.querySelector('.delete-note').onclick = e => {
      e.stopPropagation();
      moveNodeToTrash(n.id);
    };
    tr.onclick = () => {
      selected = n.id;
      selectedEdge = null;
      setView('overview');
      render();
    };
    notesTableBody.appendChild(tr);
  }
}

function updateTrashSelectionUI(){
  const validIds = new Set(state.trash.map(item => item.trashId));
  selectedTrash = new Set([...selectedTrash].filter(id => validIds.has(id)));
  const count = selectedTrash.size;
  restoreSelectedBtn.disabled = count === 0;
  restoreSelectedBtn.textContent = count ? `↶ Khôi phục ${count} note` : '↶ Khôi phục đã chọn';
  trashSelectionInfo.textContent = count ? `Đã chọn ${count} note trong thùng rác.` : 'Chưa chọn note nào.';
}

function renderTrash(){
  if(!trashTableBody) return;
  const q = searchInput.value.toLowerCase().trim();
  const items = [...state.trash]
    .filter(item => {
      const n = item.node;
      return !q || (`${n.title} ${plainContent(n)} ${n.tag}`).toLowerCase().includes(q);
    })
    .sort((a,b) => (b.deletedAt || 0) - (a.deletedAt || 0));
  trashTableBody.innerHTML = '';
  trashEmpty.style.display = items.length ? 'none' : 'block';
  for(const item of items){
    const n = item.node;
    const tr = document.createElement('tr');
    tr.className = selectedTrash.has(item.trashId) ? 'trash-selected' : '';
    tr.dataset.trashId = item.trashId;
    tr.innerHTML = `
      <td class="check-col"><span class="row-check">${selectedTrash.has(item.trashId) ? '✓' : ''}</span></td>
      <td><div class="table-note-title"><span class="table-color-dot" style="background:${n.color}"></span><span>${esc(n.title)}</span></div></td>
      <td><span class="table-tag">${esc(n.tag || 'Note')}</span></td>
      <td class="table-summary">${esc(noteSummary(n))}</td>
      <td class="deleted-time">${esc(formatDeletedAt(item.deletedAt))}</td>
      <td class="table-actions"><button class="mini-action restore-one" type="button">Khôi phục</button></td>
    `;
    tr.onclick = e => {
      if(e.target.closest('button')) return;
      if(selectedTrash.has(item.trashId)) selectedTrash.delete(item.trashId); else selectedTrash.add(item.trashId);
      renderTrash();
    };
    tr.querySelector('.restore-one').onclick = e => {
      e.stopPropagation();
      restoreTrashItems([item.trashId]);
    };
    trashTableBody.appendChild(tr);
  }
  updateTrashSelectionUI();
}

function edgeExists(candidate){
  return state.edges.some(edge => edge.id === candidate.id || (
    edge.source === candidate.source && edge.target === candidate.target &&
    edge.sourceHandle === candidate.sourceHandle && edge.targetHandle === candidate.targetHandle
  ));
}

function restoreAvailableTrashEdges(){
  const liveIds = new Set(state.nodes.map(n => n.id));
  const pending = [];
  for(const edge of state.trashEdges){
    if(liveIds.has(edge.source) && liveIds.has(edge.target)){
      if(!edgeExists(edge)) state.edges.push(edge);
    }else{
      pending.push(edge);
    }
  }
  state.trashEdges = pending;
}

function moveNodeToTrash(nodeId){
  const n = nodeBy(nodeId);
  if(!n) return;
  const incident = state.edges.filter(edge => edge.source === nodeId || edge.target === nodeId);
  for(const edge of incident){
    if(!state.trashEdges.some(saved => saved.id === edge.id)) state.trashEdges.push(JSON.parse(JSON.stringify(edge)));
  }
  state.trash.push({
    trashId:`trash-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
    node:JSON.parse(JSON.stringify(n)),
    deletedAt:Date.now()
  });
  state.nodes = state.nodes.filter(item => item.id !== nodeId);
  state.edges = state.edges.filter(edge => edge.source !== nodeId && edge.target !== nodeId);
  if(selected === nodeId) selected = null;
  selectedEdge = null;
  save();
  render();
  if(activeView === 'trash') renderTrash();
}

function restoreTrashItems(trashIds){
  const ids = new Set(trashIds);
  const restoring = state.trash.filter(item => ids.has(item.trashId));
  if(!restoring.length) return;
  const liveIds = new Set(state.nodes.map(n => n.id));
  for(const item of restoring){
    let node = JSON.parse(JSON.stringify(item.node));
    if(liveIds.has(node.id)){
      const oldId = node.id;
      node.id = `${oldId}-restored-${Date.now()}`;
      state.trashEdges = state.trashEdges.map(edge => ({
        ...edge,
        source:edge.source === oldId ? node.id : edge.source,
        target:edge.target === oldId ? node.id : edge.target
      }));
    }
    liveIds.add(node.id);
    state.nodes.push(node);
    selectedTrash.delete(item.trashId);
  }
  state.trash = state.trash.filter(item => !ids.has(item.trashId));
  restoreAvailableTrashEdges();
  save();
  render();
  renderTrash();
}

function render(){
  nodesEl.innerHTML = '';

  for(const n of state.nodes){
    const el = document.createElement('div');
    el.className = 'node' + (selected === n.id ? ' selected' : '') + (/<img\b/i.test(richContent(n)) ? ' has-image' : '');
    el.style.left = n.x + 'px';
    el.style.top = n.y + 'px';
    el.style.borderColor = n.color;
    el.dataset.id = n.id;
    el.innerHTML = `
      <div class="head"><span class="note-dot" style="background:${n.color}"></span>${esc(n.title)}</div>
      <div class="bodytxt">${richContent(n)}</div>
      <span class="pill">${esc(n.tag || 'Note')}</span>
      <span class="handle h-r" data-h="r" title="Điểm nối phải"></span>
      <span class="handle h-l" data-h="l" title="Điểm nối trái"></span>
      <span class="handle h-t" data-h="t" title="Điểm nối trên"></span>
      <span class="handle h-b" data-h="b" title="Điểm nối dưới"></span>
    `;

    nodesEl.appendChild(el);

    el.querySelector('.head').onpointerdown = e => startDrag(e, n, el);
    el.onclick = e => {
      if(!e.target.classList.contains('handle')) selectNode(n.id);
    };

    el.querySelectorAll('.handle').forEach(handle => {
      handle.onpointerdown = e => startLink(e, n.id, handle.dataset.h);
    });
  }

  markSelectedEdgeEndpoints();

  requestAnimationFrame(() => {
    drawEdges();
    applyTransform();
  });
  syncEditor();
  applySearchFilter();
  updateNavCounts();
  if(activeView === 'notes') renderAllNotes();
  if(activeView === 'trash') renderTrash();
}

function getHandlePoint(nodeId, handleId){
  const nodeEl = nodesEl.querySelector(`.node[data-id="${CSS.escape(nodeId)}"]`);
  if(!nodeEl) return null;
  const handle = nodeEl.querySelector(`.handle[data-h="${CSS.escape(handleId)}"]`);
  if(!handle) return null;

  return {
    x: nodeEl.offsetLeft + handle.offsetLeft + handle.offsetWidth / 2,
    y: nodeEl.offsetTop + handle.offsetTop + handle.offsetHeight / 2
  };
}

function pathForPorts(a, b, sourceHandle, targetHandle){
  const gap = 75;
  const dir = {
    l:{x:-1,y:0}, r:{x:1,y:0}, t:{x:0,y:-1}, b:{x:0,y:1}
  };
  const d1 = dir[sourceHandle] || {x:1,y:0};
  const d2 = dir[targetHandle] || {x:-1,y:0};

  const c1 = {x:a.x + d1.x * gap, y:a.y + d1.y * gap};
  const c2 = {x:b.x + d2.x * gap, y:b.y + d2.y * gap};
  return `M ${a.x} ${a.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${b.x} ${b.y}`;
}

function drawEdges(){
  svg.innerHTML = '';

  for(const edge of state.edges){
    const sourceNode = nodeBy(edge.source);
    const targetNode = nodeBy(edge.target);
    if(!sourceNode || !targetNode) continue;

    const a = getHandlePoint(edge.source, edge.sourceHandle);
    const b = getHandlePoint(edge.target, edge.targetHandle);
    if(!a || !b) continue;

    // Invisible thick path makes the wire easy to click with the left mouse button.
    const hit = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    hit.setAttribute('d', pathForPorts(a, b, edge.sourceHandle, edge.targetHandle));
    hit.setAttribute('fill', 'none');
    hit.setAttribute('stroke', 'transparent');
    hit.setAttribute('stroke-width', '18');
    hit.setAttribute('class', 'edge-hit');
    hit.dataset.edgeId = edge.id;
    hit.onpointerdown = e => {
      e.preventDefault();
      e.stopPropagation();
      selectEdge(edge.id);
    };
    hit.ondblclick = e => {
      e.preventDefault();
      e.stopPropagation();
      removeEdge(edge.id);
    };
    svg.appendChild(hit);

    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', pathForPorts(a, b, edge.sourceHandle, edge.targetHandle));
    p.setAttribute('fill', 'none');
    p.setAttribute('stroke', sourceNode.color);
    p.setAttribute('stroke-width', selectedEdge === edge.id ? '4.5' : '3');
    p.setAttribute('stroke-linecap', 'round');
    p.setAttribute('opacity', selectedEdge === edge.id ? '1' : '.95');
    p.setAttribute('class', 'edge-line' + (selectedEdge === edge.id ? ' selected-edge' : ''));
    svg.appendChild(p);
  }

  if(linkStart && linkPointer){
    let a = null;
    let sourceHandle = 'r';

    if(linkStart.mode === 'create'){
      a = getHandlePoint(linkStart.nodeId, linkStart.handleId);
      sourceHandle = linkStart.handleId;
    }else if(linkStart.mode === 'rewire'){
      a = getHandlePoint(linkStart.fixedNodeId, linkStart.fixedHandleId);
      sourceHandle = linkStart.fixedHandleId;
    }

    if(a){
      const preview = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      preview.setAttribute('d', pathForPorts(a, linkPointer, sourceHandle, oppositeForPreview(sourceHandle)));
      preview.setAttribute('fill', 'none');
      preview.setAttribute('stroke', '#c4b5fd');
      preview.setAttribute('stroke-width', '2.5');
      preview.setAttribute('stroke-dasharray', '7 7');
      preview.setAttribute('stroke-linecap', 'round');
      preview.setAttribute('opacity', '.9');
      preview.setAttribute('class', 'edge-preview');
      svg.appendChild(preview);
    }
  }
}

function oppositeForPreview(handle){
  return ({l:'r',r:'l',t:'b',b:'t'})[handle] || 'l';
}

function applyTransform(){
  world.style.transform = `translate(${pan.x}px,${pan.y}px) scale(${zoom})`;
}

function selectNode(id){
  selected = id;
  selectedEdge = null;
  render();
}

function selectEdge(id){
  selected = null;
  selectedEdge = id;
  render();
}

function syncEditor(){
  const n = nodeBy(selected);
  const edge = edgeBy(selectedEdge);
  const editor = document.getElementById('editor');
  const edgeEditor = document.getElementById('edgeEditor');
  const empty = document.getElementById('noSelection');

  editor.style.display = n ? 'block' : 'none';
  edgeEditor.style.display = edge && !n ? 'block' : 'none';
  empty.style.display = (!n && !edge) ? 'block' : 'none';

  if(n){
    titleInput.value = n.title;
    tagInput.value = n.tag || '';
    if(editorLoadedNodeId !== n.id || document.activeElement !== richEditor){
      if(editorLoadedNodeId !== n.id) savedRichRange = null;
      richEditor.innerHTML = richContent(n);
      if(normalizeImageBlocks(richEditor)) persistRichContent();
      editorLoadedNodeId = n.id;
    }
    updateRgbControls(n.color);
  }else{
    editorLoadedNodeId = null;
  }

  if(edge){
    const source = nodeBy(edge.source);
    const target = nodeBy(edge.target);
    document.getElementById('edgeInfo').innerHTML = `
      <div><b>${esc(source?.title || 'Note')}</b> · điểm ${handleName(edge.sourceHandle)}</div>
      <div class="edge-arrow">↕</div>
      <div><b>${esc(target?.title || 'Note')}</b> · điểm ${handleName(edge.targetHandle)}</div>
    `;
  }
}

function startDrag(e, n, el){
  if(linkStart) return;
  selectedEdge = null;
  drag = {n, ox:e.clientX, oy:e.clientY, sx:n.x, sy:n.y};
  el.setPointerCapture(e.pointerId);
}

function startLink(e, nodeId, handleId){
  e.preventDefault();
  e.stopPropagation();

  const edge = edgeBy(selectedEdge);
  const isSelectedSource = edge && edge.source === nodeId && edge.sourceHandle === handleId;
  const isSelectedTarget = edge && edge.target === nodeId && edge.targetHandle === handleId;

  if(isSelectedSource || isSelectedTarget){
    // Rewire mode: dragging one of the two highlighted endpoint dots moves that exact end.
    const movingEnd = isSelectedSource ? 'source' : 'target';
    linkStart = {
      mode:'rewire',
      edgeId:edge.id,
      movingEnd,
      originalNodeId:nodeId,
      originalHandleId:handleId,
      fixedNodeId: movingEnd === 'source' ? edge.target : edge.source,
      fixedHandleId: movingEnd === 'source' ? edge.targetHandle : edge.sourceHandle
    };
  }else{
    // Create mode: every one of the four handles is fully independent.
    selected = nodeId;
    selectedEdge = null;
    linkStart = {mode:'create', nodeId, handleId};
  }

  linkPointer = screenToWorld(e.clientX, e.clientY);
  document.body.classList.add('is-linking');
  highlightHandle(nodeId, handleId, true);
  drawEdges();
  syncEditor();
}

function screenToWorld(clientX, clientY){
  const r = canvas.getBoundingClientRect();
  return {
    x: (clientX - r.left - pan.x) / zoom,
    y: (clientY - r.top - pan.y) / zoom
  };
}

function highlightHandle(nodeId, handleId, active){
  const handle = nodesEl.querySelector(`.node[data-id="${CSS.escape(nodeId)}"] .handle[data-h="${CSS.escape(handleId)}"]`);
  if(handle) handle.classList.toggle('link-active', active);
}

function clearTargetHighlights(){
  nodesEl.querySelectorAll('.handle.link-target').forEach(h => h.classList.remove('link-target'));
}

function markSelectedEdgeEndpoints(){
  nodesEl.querySelectorAll('.handle.edge-endpoint').forEach(h => h.classList.remove('edge-endpoint'));
  const edge = edgeBy(selectedEdge);
  if(!edge) return;

  const a = nodesEl.querySelector(`.node[data-id="${CSS.escape(edge.source)}"] .handle[data-h="${CSS.escape(edge.sourceHandle)}"]`);
  const b = nodesEl.querySelector(`.node[data-id="${CSS.escape(edge.target)}"] .handle[data-h="${CSS.escape(edge.targetHandle)}"]`);
  if(a) a.classList.add('edge-endpoint');
  if(b) b.classList.add('edge-endpoint');
}

function targetAllowed(targetNodeId){
  if(!linkStart) return false;
  if(linkStart.mode === 'create') return targetNodeId !== linkStart.nodeId;
  return targetNodeId !== linkStart.fixedNodeId;
}

function updateTargetHighlight(clientX, clientY){
  clearTargetHighlights();
  if(!linkStart) return;
  const under = document.elementFromPoint(clientX, clientY);
  const targetHandle = under?.closest?.('.handle');
  const targetNode = targetHandle?.closest?.('.node');
  if(targetHandle && targetNode && targetAllowed(targetNode.dataset.id)){
    targetHandle.classList.add('link-target');
  }
}

function isDuplicateConnection(candidate, ignoreEdgeId = null){
  return state.edges.some(edge => {
    if(edge.id === ignoreEdgeId) return false;
    const sameDirection =
      edge.source === candidate.source &&
      edge.sourceHandle === candidate.sourceHandle &&
      edge.target === candidate.target &&
      edge.targetHandle === candidate.targetHandle;
    const reverseDirection =
      edge.source === candidate.target &&
      edge.sourceHandle === candidate.targetHandle &&
      edge.target === candidate.source &&
      edge.targetHandle === candidate.sourceHandle;
    return sameDirection || reverseDirection;
  });
}

function removeEdge(id){
  state.edges = state.edges.filter(edge => edge.id !== id);
  if(selectedEdge === id) selectedEdge = null;
  save();
  render();
}

function finishLink(e){
  if(!linkStart) return;

  const under = document.elementFromPoint(e.clientX, e.clientY);
  const targetHandle = under?.closest?.('.handle');
  const targetNode = targetHandle?.closest?.('.node');
  const hasValidTarget = targetHandle && targetNode && targetAllowed(targetNode.dataset.id);

  if(linkStart.mode === 'create'){
    if(hasValidTarget){
      const candidate = {
        source:linkStart.nodeId,
        sourceHandle:linkStart.handleId,
        target:targetNode.dataset.id,
        targetHandle:targetHandle.dataset.h
      };
      if(!isDuplicateConnection(candidate)){
        state.edges.push({id:'e' + Date.now(), ...candidate});
        save();
      }
    }
  }else if(linkStart.mode === 'rewire'){
    const edge = edgeBy(linkStart.edgeId);
    if(edge){
      if(hasValidTarget){
        const candidate = {...edge};
        if(linkStart.movingEnd === 'source'){
          candidate.source = targetNode.dataset.id;
          candidate.sourceHandle = targetHandle.dataset.h;
        }else{
          candidate.target = targetNode.dataset.id;
          candidate.targetHandle = targetHandle.dataset.h;
        }

        if(!isDuplicateConnection(candidate, edge.id)){
          edge.source = candidate.source;
          edge.sourceHandle = candidate.sourceHandle;
          edge.target = candidate.target;
          edge.targetHandle = candidate.targetHandle;
          save();
        }
      }else{
        // Dropping a selected wire endpoint on empty canvas = disconnect/remove wire.
        state.edges = state.edges.filter(item => item.id !== edge.id);
        selectedEdge = null;
        save();
      }
    }
  }

  highlightHandle(linkStart.originalNodeId || linkStart.nodeId, linkStart.originalHandleId || linkStart.handleId, false);
  clearTargetHighlights();
  document.body.classList.remove('is-linking');
  linkStart = null;
  linkPointer = null;
  render();
}

window.onpointermove = e => {
  if(drag){
    drag.n.x = drag.sx + (e.clientX - drag.ox) / zoom;
    drag.n.y = drag.sy + (e.clientY - drag.oy) / zoom;
    render();
    return;
  }

  if(linkStart){
    linkPointer = screenToWorld(e.clientX, e.clientY);
    updateTargetHighlight(e.clientX, e.clientY);
    drawEdges();
    return;
  }

  if(panning){
    pan.x = panning.x + (e.clientX - panning.cx);
    pan.y = panning.y + (e.clientY - panning.cy);
    applyTransform();
  }
};

window.onpointerup = e => {
  if(drag){
    drag = null;
    save();
  }

  if(panning) panning = null;

  if(linkStart) finishLink(e);
};

canvas.onpointerdown = e => {
  if(linkStart) return;
  if(e.target === canvas || e.target === world || e.target === nodesEl || e.target === svg){
    selected = null;
    selectedEdge = null;
    render();
    panning = {cx:e.clientX, cy:e.clientY, x:pan.x, y:pan.y};
  }
};

canvas.onwheel = e => {
  e.preventDefault();
  const old = zoom;
  zoom = Math.min(2.2, Math.max(.35, zoom * (e.deltaY < 0 ? 1.1 : .9)));
  const r = canvas.getBoundingClientRect();
  const mx = e.clientX - r.left;
  const my = e.clientY - r.top;
  pan.x = mx - (mx - pan.x) * (zoom / old);
  pan.y = my - (my - pan.y) * (zoom / old);
  applyTransform();
};

function addNote(){
  activeView = 'overview';
  const id = 'n' + Date.now();
  state.nodes.push({
    id,
    x:(350 - pan.x) / zoom,
    y:(180 - pan.y) / zoom,
    title:'Note mới',
    content:'Nhập nội dung...',
    contentHtml:'Nhập nội dung...',
    tag:'Note',
    color:'#8b5cf6'
  });
  selected = id;
  selectedEdge = null;
  save();
  render();
  setView('overview');
}

document.getElementById('addTop').onclick = addNote;
document.getElementById('addSide').onclick = addNote;
document.getElementById('zoomIn').onclick = () => { zoom = Math.min(2.2, zoom * 1.15); applyTransform(); };
document.getElementById('zoomOut').onclick = () => { zoom = Math.max(.35, zoom / 1.15); applyTransform(); };
document.getElementById('fit').onclick = () => { zoom = .85; pan = {x:0,y:0}; applyTransform(); };
document.getElementById('resetBtn').onclick = () => {
  if(confirm('Làm trống toàn bộ nội dung của dự án hiện tại?')){
    state = blankState();
    selected = null;
    selectedEdge = null;
    selectedTrash.clear();
    activeView = 'overview';
    save();
    render();
    setView('overview');
  }
};

titleInput.oninput = () => {
  const n = nodeBy(selected);
  if(n){ n.title = titleInput.value; save(); refreshNodeVisual(n.id); }
};
tagInput.oninput = () => {
  const n = nodeBy(selected);
  if(n){ n.tag = tagInput.value; save(); refreshNodeVisual(n.id); }
};

function persistRichContent(){
  const n = nodeBy(selected);
  if(!n) return;
  richEditor.querySelectorAll('.image-block-selected').forEach(el => el.classList.remove('image-block-selected'));
  const safe = sanitizeHtml(richEditor.innerHTML);
  if(richEditor.innerHTML !== safe) richEditor.innerHTML = safe;
  n.contentHtml = safe;
  const plainBox = richEditor.cloneNode(true);
  plainBox.querySelectorAll('.image-edit-btn,.image-remove-btn,.file-remove-btn,.image-annotation-overlay').forEach(el => el.remove());
  n.content = plainBox.innerText || plainBox.textContent || '';
  save();
  refreshNodeVisual(n.id);
}

function saveRichSelection(){
  const sel = window.getSelection();
  if(!sel || !sel.rangeCount) return;
  const range = sel.getRangeAt(0);
  if(richEditor.contains(range.commonAncestorContainer)) savedRichRange = range.cloneRange();
}
function restoreRichSelection(){
  richEditor.focus();
  if(!savedRichRange) return;
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(savedRichRange);
}
function runRichCommand(command, value=null){
  restoreRichSelection();
  try{ document.execCommand('styleWithCSS', false, true); }catch(_){ }
  document.execCommand(command, false, value);
  saveRichSelection();
  persistRichContent();
  refreshToolbarState();
}
function refreshToolbarState(){
  document.querySelectorAll('[data-state-command]').forEach(btn => {
    try{ btn.classList.toggle('active', document.queryCommandState(btn.dataset.stateCommand)); }
    catch(_){ btn.classList.remove('active'); }
  });
}


function readFileAsDataUrl(file){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('Không đọc được ảnh.'));
    reader.readAsDataURL(file);
  });
}

function loadImageElement(src){
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Ảnh không hợp lệ.'));
    img.src = src;
  });
}

async function prepareImageDataUrl(file){
  if(!file || !/^image\/(png|jpeg|webp)$/i.test(file.type || '')) throw new Error('Chỉ hỗ trợ PNG, JPG/JPEG và WebP.');
  if(file.size > 15 * 1024 * 1024) throw new Error('Ảnh quá lớn. Hãy chọn ảnh nhỏ hơn 15 MB.');

  const original = await readFileAsDataUrl(file);
  const img = await loadImageElement(original);
  const maxSide = 1600;
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
  if(scale >= .999 && file.size <= 2.5 * 1024 * 1024) return original;

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  // WebP keeps the .notemap file much smaller while retaining good visual quality.
  try{ return canvas.toDataURL('image/webp', .88); }
  catch(_){ return original; }
}

function ensureRichCaret(){
  richEditor.focus();
  const sel = window.getSelection();
  if(savedRichRange){
    try{
      sel.removeAllRanges();
      sel.addRange(savedRichRange);
      return sel.getRangeAt(0);
    }catch(_){ }
  }
  const range = document.createRange();
  range.selectNodeContents(richEditor);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
  return range;
}

function imageAnnotationsFromBlock(block){
  if(!block) return [];
  try{
    const value = JSON.parse(block.dataset.annotations || '[]');
    return Array.isArray(value) ? value : [];
  }catch(_){
    return [];
  }
}

function imageSvgEl(name, attrs={}){
  const el = document.createElementNS('http://www.w3.org/2000/svg', name);
  for(const [key,value] of Object.entries(attrs)) el.setAttribute(key, String(value));
  return el;
}

function annotationArrowPoints(a){
  const x1=a.x1||0,y1=a.y1||0,x2=a.x2||0,y2=a.y2||0;
  const dx=x2-x1,dy=y2-y1,len=Math.hypot(dx,dy)||1;
  const ux=dx/len,uy=dy/len;
  const size=Math.max(16,(a.width||4)*5.5);
  const bx=x2-ux*size,by=y2-uy*size;
  const px=-uy*(size*.48),py=ux*(size*.48);
  return `${x2},${y2} ${bx+px},${by+py} ${bx-px},${by-py}`;
}

function renderImageAnnotationOverlay(block){
  if(!block) return;
  block.querySelector('.image-annotation-overlay')?.remove();
  const annotations=imageAnnotationsFromBlock(block);
  if(!annotations.length) return;
  const svg=imageSvgEl('svg',{class:'image-annotation-overlay',viewBox:'0 0 1000 1000',preserveAspectRatio:'none','aria-hidden':'true'});
  for(const a of annotations){
    const color=a.color||'#ff4d67';
    const width=Math.max(1,Number(a.width)||4);
    const opacity=Math.max(.05,Math.min(1,Number(a.opacity) || 1));
    const common={stroke:color,'stroke-width':width,opacity,'vector-effect':'non-scaling-stroke'};
    let el=null;
    if(a.type==='rect'){
      const x=Math.min(a.x1,a.x2),y=Math.min(a.y1,a.y2),w=Math.abs(a.x2-a.x1),h=Math.abs(a.y2-a.y1);
      el=imageSvgEl('rect',{x,y,width:w,height:h,rx:8,fill:color,'fill-opacity':Math.max(0,Math.min(.5,Number(a.fillOpacity)||0)),...common});
    }else if(a.type==='ellipse'){
      const cx=(a.x1+a.x2)/2,cy=(a.y1+a.y2)/2,rx=Math.abs(a.x2-a.x1)/2,ry=Math.abs(a.y2-a.y1)/2;
      el=imageSvgEl('ellipse',{cx,cy,rx,ry,fill:color,'fill-opacity':Math.max(0,Math.min(.5,Number(a.fillOpacity)||0)),...common});
    }else if(a.type==='free' && Array.isArray(a.points) && a.points.length){
      el=imageSvgEl('polyline',{points:a.points.map(p=>`${p[0]},${p[1]}`).join(' '),fill:'none','stroke-linecap':'round','stroke-linejoin':'round',...common});
    }else if(a.type==='arrow'){
      const group=imageSvgEl('g');
      group.appendChild(imageSvgEl('line',{x1:a.x1,y1:a.y1,x2:a.x2,y2:a.y2,'stroke-linecap':'round',...common}));
      group.appendChild(imageSvgEl('polygon',{points:annotationArrowPoints(a),fill:color,opacity}));
      svg.appendChild(group);
      continue;
    }else if(a.type==='text'){
      el=imageSvgEl('text',{x:a.x,y:a.y,fill:color,opacity,'font-size':Math.max(18,Number(a.size)||34),'font-family':'Inter,Arial,sans-serif','font-weight':'700','paint-order':'stroke','stroke':'rgba(0,0,0,.45)','stroke-width':'2'});
      el.textContent=a.text||'';
    }
    if(el) svg.appendChild(el);
  }
  block.appendChild(svg);
}

function makeImageControl(kind){
  const btn=document.createElement('button');
  btn.type='button';
  if(kind==='edit'){
    btn.className='image-edit-btn';
    btn.setAttribute('data-edit-image','1');
    btn.title='Chỉnh sửa và đánh dấu ảnh';
    btn.innerHTML='✎ <span>Edit</span>';
  }else{
    btn.className='image-remove-btn';
    btn.setAttribute('data-remove-image','1');
    btn.title='Xóa ảnh';
    btn.setAttribute('aria-label','Xóa ảnh');
    btn.textContent='🗑';
  }
  return btn;
}

function ensureImageBlockControls(block){
  if(!block) return;
  block.dataset.notemapImageBlock='1';
  block.contentEditable='false';
  if(!block.dataset.annotations) block.dataset.annotations='[]';
  if(!block.querySelector('.image-edit-btn')) block.insertBefore(makeImageControl('edit'),block.firstChild);
  if(!block.querySelector('.image-remove-btn')) block.insertBefore(makeImageControl('remove'),block.firstChild);
  renderImageAnnotationOverlay(block);
}

function buildImageBlock(dataUrl, alt='Hình ảnh'){
  const wrap = document.createElement('div');
  wrap.className = 'image-block';
  wrap.setAttribute('data-notemap-image-block', '1');
  wrap.dataset.annotations='[]';
  wrap.contentEditable = 'false';

  const img = document.createElement('img');
  img.src = dataUrl;
  img.alt = alt || 'Hình ảnh';
  img.setAttribute('data-notemap-image', '1');
  img.draggable = false;

  wrap.appendChild(makeImageControl('edit'));
  wrap.appendChild(makeImageControl('remove'));
  wrap.appendChild(img);
  return wrap;
}

function normalizeImageBlocks(container){
  if(!container) return false;
  let changed = false;
  [...container.querySelectorAll('img[data-notemap-image]')].forEach(img => {
    let block = img.closest('.image-block');
    if(!block){
      block = buildImageBlock(img.getAttribute('src') || '', img.getAttribute('alt') || 'Hình ảnh');
      img.replaceWith(block);
      changed = true;
    }else{
      const before=block.innerHTML;
      ensureImageBlockControls(block);
      if(before!==block.innerHTML) changed=true;
    }
  });
  return changed;
}

function insertImageIntoEditor(dataUrl, alt='Hình ảnh'){
  const n = nodeBy(selected);
  if(!n) return;
  const range = ensureRichCaret();
  range.deleteContents();

  const block = buildImageBlock(dataUrl, alt);
  const spacerAfter = document.createElement('p');
  spacerAfter.innerHTML = '<br>';
  range.insertNode(spacerAfter);
  range.insertNode(block);

  const next = document.createRange();
  next.setStart(spacerAfter, 0);
  next.collapse(true);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(next);
  savedRichRange = next.cloneRange();
  persistRichContent();
  refreshToolbarState();
}

async function insertImageFile(file){
  if(!selected) return;
  try{
    const dataUrl = await prepareImageDataUrl(file);
    insertImageIntoEditor(dataUrl, file.name || 'Hình ảnh');
  }catch(err){
    alert(err?.message || 'Không thể chèn ảnh.');
  }
}

function humanFileSize(bytes=0){
  const value = Number(bytes) || 0;
  if(value < 1024) return `${value} B`;
  if(value < 1024 * 1024) return `${(value / 1024).toFixed(value < 10 * 1024 ? 1 : 0)} KB`;
  return `${(value / (1024 * 1024)).toFixed(value < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

function fileIconFor(name='', type=''){
  const ext = String(name).split('.').pop()?.toLowerCase() || '';
  const mime = String(type).toLowerCase();
  if(mime.startsWith('image/')) return '🖼';
  if(mime.startsWith('audio/')) return '🎵';
  if(mime.startsWith('video/')) return '🎬';
  if(mime.includes('pdf') || ext === 'pdf') return '📕';
  if(['doc','docx','odt','rtf'].includes(ext)) return '📝';
  if(['xls','xlsx','csv','ods'].includes(ext)) return '📊';
  if(['ppt','pptx','odp'].includes(ext)) return '📽';
  if(['zip','rar','7z','tar','gz'].includes(ext)) return '📦';
  if(['js','ts','py','java','cpp','c','cs','html','css','json','xml','sql'].includes(ext)) return '💻';
  return '📄';
}

function buildFileBlock({dataUrl, name='Tệp đính kèm', type='', size=0}){
  const wrap = document.createElement('div');
  wrap.className = 'file-block';
  wrap.setAttribute('data-notemap-file', '1');
  wrap.contentEditable = 'false';

  const icon = document.createElement('span');
  icon.className = 'file-icon';
  icon.textContent = fileIconFor(name, type);

  const meta = document.createElement('span');
  meta.className = 'file-meta';

  const link = document.createElement('a');
  link.className = 'file-name';
  link.href = dataUrl;
  link.download = name || 'file';
  link.textContent = name || 'Tệp đính kèm';
  link.setAttribute('title', `Tải ${name || 'tệp đính kèm'}`);

  const info = document.createElement('span');
  info.className = 'file-info';
  const ext = String(name).includes('.') ? String(name).split('.').pop().toUpperCase() : 'FILE';
  info.textContent = `${ext} • ${humanFileSize(size)}`;

  const del = document.createElement('button');
  del.type = 'button';
  del.className = 'file-remove-btn';
  del.setAttribute('data-remove-file', '1');
  del.setAttribute('title', 'Xóa file');
  del.setAttribute('aria-label', 'Xóa file');
  del.textContent = '🗑';

  meta.appendChild(link);
  meta.appendChild(info);
  wrap.appendChild(icon);
  wrap.appendChild(meta);
  wrap.appendChild(del);
  return wrap;
}

function insertFileIntoEditor(fileData){
  const n = nodeBy(selected);
  if(!n) return;
  const range = ensureRichCaret();
  range.deleteContents();

  const block = buildFileBlock(fileData);
  const spacerAfter = document.createElement('p');
  spacerAfter.innerHTML = '<br>';
  range.insertNode(spacerAfter);
  range.insertNode(block);

  const next = document.createRange();
  next.setStart(spacerAfter, 0);
  next.collapse(true);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(next);
  savedRichRange = next.cloneRange();
  persistRichContent();
  refreshToolbarState();
}

async function insertAttachmentFile(file){
  if(!selected || !file) return;
  const dataUrl = await readFileAsDataUrl(file);
  insertFileIntoEditor({
    dataUrl,
    name:file.name || 'Tệp đính kèm',
    type:file.type || '',
    size:file.size || 0
  });
}


// ----- Image annotation editor -------------------------------------------------
const IMAGE_ANNOTATION_REF = 1000;
let imageEditSession = null;
const imageEditorCtx = imageEditorCanvas.getContext('2d');

function cloneJson(value){
  return JSON.parse(JSON.stringify(value));
}

function imageEditorSnapshot(){
  return JSON.stringify(imageEditSession?.annotations || []);
}

function imageEditorRefreshHistoryButtons(){
  if(!imageEditSession) return;
  imageEditUndoBtn.disabled = imageEditSession.historyIndex <= 0;
  imageEditRedoBtn.disabled = imageEditSession.historyIndex >= imageEditSession.history.length - 1;
}

function imageEditorPushHistory(){
  if(!imageEditSession) return;
  const snap=imageEditorSnapshot();
  if(imageEditSession.history[imageEditSession.historyIndex]===snap) return;
  imageEditSession.history=imageEditSession.history.slice(0,imageEditSession.historyIndex+1);
  imageEditSession.history.push(snap);
  if(imageEditSession.history.length>80) imageEditSession.history.shift();
  imageEditSession.historyIndex=imageEditSession.history.length-1;
  imageEditorRefreshHistoryButtons();
}

function imageEditorRestoreHistory(index){
  if(!imageEditSession) return;
  const next=Math.max(0,Math.min(imageEditSession.history.length-1,index));
  if(next===imageEditSession.historyIndex) return;
  imageEditSession.historyIndex=next;
  imageEditSession.annotations=JSON.parse(imageEditSession.history[next] || '[]');
  imageEditSession.selected=-1;
  imageEditSession.temp=null;
  imageEditSession.gesture=null;
  imageEditorSyncSelectedUI();
  imageEditorRefreshHistoryButtons();
  drawImageEditor();
}

function imageEditorUndo(){
  if(imageEditSession) imageEditorRestoreHistory(imageEditSession.historyIndex-1);
}
function imageEditorRedo(){
  if(imageEditSession) imageEditorRestoreHistory(imageEditSession.historyIndex+1);
}

function imageToolLabel(type){
  return ({rect:'Rectangle',ellipse:'Ellipse',free:'Free draw',arrow:'Arrow',text:'Text'})[type] || 'Đối tượng';
}

function imageEditorSetTool(tool){
  if(!imageEditSession) return;
  imageEditSession.tool=tool;
  imageEditSession.gesture=null;
  imageEditSession.temp=null;
  document.querySelectorAll('[data-image-tool]').forEach(btn=>btn.classList.toggle('active',btn.dataset.imageTool===tool));
  imageEditorCanvas.style.cursor = tool==='select' ? 'default' : tool==='eraser' ? 'not-allowed' : tool==='text' ? 'text' : 'crosshair';
  drawImageEditor();
}

function imageEditorSyncSelectedUI(){
  if(!imageEditSession) return;
  const a=imageEditSession.annotations[imageEditSession.selected];
  imageSelectedLabel.textContent=a ? `${imageToolLabel(a.type)} đang chọn` : 'Chưa chọn đối tượng';
  imageDeleteSelected.disabled=!a;
  if(a){
    const color=a.color || '#ff4d67';
    imageStrokeColor.value=color;
    imageStrokeHex.value=color.toUpperCase();
    imageStrokeWidth.value=Math.max(1,Math.min(16,Number(a.width)||4));
    imageOpacity.value=Math.round(Math.max(.1,Math.min(1,Number(a.opacity)||1))*100);
    if(['rect','ellipse'].includes(a.type)) imageFillOpacity.value=Math.round(Math.max(0,Math.min(.5,Number(a.fillOpacity)||0))*100);
    imageEditorUpdatePropertyLabels();
  }
}

function imageEditorUpdatePropertyLabels(){
  imageStrokeWidthValue.textContent=`${imageStrokeWidth.value} px`;
  imageOpacityValue.textContent=`${imageOpacity.value}%`;
  imageFillOpacityValue.textContent=`${imageFillOpacity.value}%`;
}

function imageEditorDefaults(){
  return {
    color:imageStrokeColor.value || '#ff4d67',
    width:Number(imageStrokeWidth.value)||4,
    opacity:(Number(imageOpacity.value)||100)/100,
    fillOpacity:(Number(imageFillOpacity.value)||0)/100
  };
}

function imageEditorApplyPropsToSelected(push=false){
  if(!imageEditSession) return;
  const a=imageEditSession.annotations[imageEditSession.selected];
  const d=imageEditorDefaults();
  imageStrokeHex.value=d.color.toUpperCase();
  imageEditorUpdatePropertyLabels();
  if(a){
    a.color=d.color;
    a.width=d.width;
    a.opacity=d.opacity;
    if(['rect','ellipse'].includes(a.type)) a.fillOpacity=d.fillOpacity;
    drawImageEditor();
    if(push) imageEditorPushHistory();
  }
}

function canvasPointFromEvent(e){
  const rect=imageEditorCanvas.getBoundingClientRect();
  const x=(e.clientX-rect.left)*(imageEditorCanvas.width/rect.width);
  const y=(e.clientY-rect.top)*(imageEditorCanvas.height/rect.height);
  return {
    x,y,
    nx:(x/imageEditorCanvas.width)*IMAGE_ANNOTATION_REF,
    ny:(y/imageEditorCanvas.height)*IMAGE_ANNOTATION_REF
  };
}

function annotationToCanvasPoint(nx,ny){
  return {x:(nx/IMAGE_ANNOTATION_REF)*imageEditorCanvas.width,y:(ny/IMAGE_ANNOTATION_REF)*imageEditorCanvas.height};
}

function annotationBounds(a){
  if(!a) return null;
  if(['rect','ellipse','arrow'].includes(a.type)){
    return {left:Math.min(a.x1,a.x2),top:Math.min(a.y1,a.y2),right:Math.max(a.x1,a.x2),bottom:Math.max(a.y1,a.y2)};
  }
  if(a.type==='free' && Array.isArray(a.points) && a.points.length){
    const xs=a.points.map(p=>p[0]),ys=a.points.map(p=>p[1]);
    return {left:Math.min(...xs),top:Math.min(...ys),right:Math.max(...xs),bottom:Math.max(...ys)};
  }
  if(a.type==='text'){
    const width=Math.max(50,String(a.text||'').length*(Number(a.size)||34)*.55);
    const height=(Number(a.size)||34)*1.25;
    return {left:a.x,top:a.y-height,right:a.x+width,bottom:a.y+8};
  }
  return null;
}

function distanceToSegment(px,py,x1,y1,x2,y2){
  const dx=x2-x1,dy=y2-y1;
  if(!dx&&!dy) return Math.hypot(px-x1,py-y1);
  const t=Math.max(0,Math.min(1,((px-x1)*dx+(py-y1)*dy)/(dx*dx+dy*dy)));
  return Math.hypot(px-(x1+t*dx),py-(y1+t*dy));
}

function hitAnnotation(a,nx,ny,tol){
  if(!a) return false;
  if(a.type==='rect'){
    const b=annotationBounds(a);
    const onEdge=nx>=b.left-tol&&nx<=b.right+tol&&ny>=b.top-tol&&ny<=b.bottom+tol&&(
      Math.abs(nx-b.left)<=tol||Math.abs(nx-b.right)<=tol||Math.abs(ny-b.top)<=tol||Math.abs(ny-b.bottom)<=tol
    );
    const inside=nx>=b.left&&nx<=b.right&&ny>=b.top&&ny<=b.bottom;
    return onEdge||inside;
  }
  if(a.type==='ellipse'){
    const cx=(a.x1+a.x2)/2,cy=(a.y1+a.y2)/2,rx=Math.abs(a.x2-a.x1)/2+tol,ry=Math.abs(a.y2-a.y1)/2+tol;
    if(rx<1||ry<1) return false;
    const q=((nx-cx)*(nx-cx))/(rx*rx)+((ny-cy)*(ny-cy))/(ry*ry);
    return q<=1.15;
  }
  if(a.type==='arrow') return distanceToSegment(nx,ny,a.x1,a.y1,a.x2,a.y2)<=tol*1.5;
  if(a.type==='free' && Array.isArray(a.points)){
    for(let i=1;i<a.points.length;i++) if(distanceToSegment(nx,ny,...a.points[i-1],...a.points[i])<=tol*1.5) return true;
    return false;
  }
  if(a.type==='text'){
    const b=annotationBounds(a);return nx>=b.left-tol&&nx<=b.right+tol&&ny>=b.top-tol&&ny<=b.bottom+tol;
  }
  return false;
}

function findAnnotationAt(nx,ny){
  if(!imageEditSession) return -1;
  const rect=imageEditorCanvas.getBoundingClientRect();
  const tol=Math.max(6,(10/Math.max(1,rect.width))*IMAGE_ANNOTATION_REF);
  for(let i=imageEditSession.annotations.length-1;i>=0;i--) if(hitAnnotation(imageEditSession.annotations[i],nx,ny,tol)) return i;
  return -1;
}

function selectedHandleAt(nx,ny){
  if(!imageEditSession) return null;
  const a=imageEditSession.annotations[imageEditSession.selected];
  if(!a||!['rect','ellipse'].includes(a.type)) return null;
  const b=annotationBounds(a);
  const handles={tl:[b.left,b.top],tr:[b.right,b.top],bl:[b.left,b.bottom],br:[b.right,b.bottom]};
  const rect=imageEditorCanvas.getBoundingClientRect();
  const tol=Math.max(8,(12/Math.max(1,rect.width))*IMAGE_ANNOTATION_REF);
  for(const [key,[x,y]] of Object.entries(handles)) if(Math.hypot(nx-x,ny-y)<=tol) return key;
  return null;
}

function moveAnnotationFrom(original,dx,dy){
  const a=cloneJson(original);
  const clamp=(v)=>Math.max(-200,Math.min(1200,v));
  if(['rect','ellipse','arrow'].includes(a.type)){
    a.x1=clamp(a.x1+dx);a.x2=clamp(a.x2+dx);a.y1=clamp(a.y1+dy);a.y2=clamp(a.y2+dy);
  }else if(a.type==='free'){
    a.points=a.points.map(([x,y])=>[clamp(x+dx),clamp(y+dy)]);
  }else if(a.type==='text'){
    a.x=clamp(a.x+dx);a.y=clamp(a.y+dy);
  }
  return a;
}

function resizeAnnotationFrom(original,handle,nx,ny){
  const b=annotationBounds(original);
  const a=cloneJson(original);
  let left=b.left,right=b.right,top=b.top,bottom=b.bottom;
  if(handle.includes('l')) left=nx;
  if(handle.includes('r')) right=nx;
  if(handle.includes('t')) top=ny;
  if(handle.includes('b')) bottom=ny;
  a.x1=Math.max(0,Math.min(1000,left));a.x2=Math.max(0,Math.min(1000,right));
  a.y1=Math.max(0,Math.min(1000,top));a.y2=Math.max(0,Math.min(1000,bottom));
  return a;
}

function drawAnnotationOnCanvas(ctx,a){
  if(!a) return;
  const color=a.color||'#ff4d67';
  const opacity=Math.max(.05,Math.min(1,Number(a.opacity)||1));
  const scale=(imageEditorCanvas.width+imageEditorCanvas.height)/2000;
  ctx.save();ctx.globalAlpha=opacity;ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=Math.max(1,(Number(a.width)||4)*scale);ctx.lineJoin='round';ctx.lineCap='round';
  if(a.type==='rect'){
    const p1=annotationToCanvasPoint(a.x1,a.y1),p2=annotationToCanvasPoint(a.x2,a.y2);
    const x=Math.min(p1.x,p2.x),y=Math.min(p1.y,p2.y),w=Math.abs(p2.x-p1.x),h=Math.abs(p2.y-p1.y);
    ctx.globalAlpha=Math.max(0,Math.min(.5,Number(a.fillOpacity)||0));ctx.fillRect(x,y,w,h);ctx.globalAlpha=opacity;ctx.strokeRect(x,y,w,h);
  }else if(a.type==='ellipse'){
    const p1=annotationToCanvasPoint(a.x1,a.y1),p2=annotationToCanvasPoint(a.x2,a.y2);
    const cx=(p1.x+p2.x)/2,cy=(p1.y+p2.y)/2,rx=Math.abs(p2.x-p1.x)/2,ry=Math.abs(p2.y-p1.y)/2;
    ctx.beginPath();ctx.ellipse(cx,cy,Math.max(1,rx),Math.max(1,ry),0,0,Math.PI*2);ctx.globalAlpha=Math.max(0,Math.min(.5,Number(a.fillOpacity)||0));ctx.fill();ctx.globalAlpha=opacity;ctx.stroke();
  }else if(a.type==='free'&&a.points?.length){
    ctx.beginPath();a.points.forEach((pt,i)=>{const p=annotationToCanvasPoint(pt[0],pt[1]);i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y)});ctx.stroke();
  }else if(a.type==='arrow'){
    const p1=annotationToCanvasPoint(a.x1,a.y1),p2=annotationToCanvasPoint(a.x2,a.y2);ctx.beginPath();ctx.moveTo(p1.x,p1.y);ctx.lineTo(p2.x,p2.y);ctx.stroke();
    const ang=Math.atan2(p2.y-p1.y,p2.x-p1.x),size=Math.max(12,ctx.lineWidth*4.2);ctx.beginPath();ctx.moveTo(p2.x,p2.y);ctx.lineTo(p2.x-Math.cos(ang-.48)*size,p2.y-Math.sin(ang-.48)*size);ctx.lineTo(p2.x-Math.cos(ang+.48)*size,p2.y-Math.sin(ang+.48)*size);ctx.closePath();ctx.fill();
  }else if(a.type==='text'){
    const p=annotationToCanvasPoint(a.x,a.y);const fontSize=Math.max(12,(Number(a.size)||34)*scale);ctx.font=`700 ${fontSize}px Inter, Arial, sans-serif`;ctx.lineWidth=Math.max(2,fontSize*.08);ctx.strokeStyle='rgba(0,0,0,.55)';ctx.strokeText(a.text||'',p.x,p.y);ctx.fillStyle=color;ctx.fillText(a.text||'',p.x,p.y);
  }
  ctx.restore();
}

function drawImageEditor(){
  if(!imageEditSession) return;
  const ctx=imageEditorCtx,w=imageEditorCanvas.width,h=imageEditorCanvas.height;
  ctx.clearRect(0,0,w,h);ctx.drawImage(imageEditSession.image,0,0,w,h);
  imageEditSession.annotations.forEach(a=>drawAnnotationOnCanvas(ctx,a));
  if(imageEditSession.temp) drawAnnotationOnCanvas(ctx,imageEditSession.temp);
  const a=imageEditSession.annotations[imageEditSession.selected];
  const b=annotationBounds(a);
  if(b){
    const p1=annotationToCanvasPoint(b.left,b.top),p2=annotationToCanvasPoint(b.right,b.bottom);
    ctx.save();ctx.strokeStyle='#8bdaff';ctx.lineWidth=Math.max(1,1.5/Math.max(.1,imageEditSession.scale));ctx.setLineDash([8/Math.max(.1,imageEditSession.scale),6/Math.max(.1,imageEditSession.scale)]);ctx.strokeRect(p1.x,p1.y,p2.x-p1.x,p2.y-p1.y);ctx.setLineDash([]);
    if(['rect','ellipse'].includes(a.type)){
      const hs=6/Math.max(.1,imageEditSession.scale);ctx.fillStyle='#ecf7ff';ctx.strokeStyle='#5f7cff';ctx.lineWidth=1/Math.max(.1,imageEditSession.scale);
      [[p1.x,p1.y],[p2.x,p1.y],[p1.x,p2.y],[p2.x,p2.y]].forEach(([x,y])=>{ctx.fillRect(x-hs,y-hs,hs*2,hs*2);ctx.strokeRect(x-hs,y-hs,hs*2,hs*2)});
    }
    ctx.restore();
  }
}

function imageEditorApplyScale(scale){
  if(!imageEditSession) return;
  imageEditSession.scale=Math.max(.08,Math.min(4,scale));
  imageEditorCanvas.style.width=`${Math.round(imageEditorCanvas.width*imageEditSession.scale)}px`;
  imageEditorCanvas.style.height=`${Math.round(imageEditorCanvas.height*imageEditSession.scale)}px`;
  imageZoomLabel.textContent=`${Math.round(imageEditSession.scale*100)}%`;
  drawImageEditor();
}

function imageEditorFit(){
  if(!imageEditSession) return;
  const w=Math.max(80,imageEditorStage.clientWidth-60),h=Math.max(80,imageEditorStage.clientHeight-60);
  imageEditorApplyScale(Math.min(1,w/imageEditorCanvas.width,h/imageEditorCanvas.height));
  imageEditorStage.scrollTo(0,0);
}

async function openImageEditor(block){
  const img=block?.querySelector('img[data-notemap-image]');
  if(!img) return;
  try{
    const loaded=await loadImageElement(img.src);
    const annotations=cloneJson(imageAnnotationsFromBlock(block));
    imageEditorCanvas.width=Math.max(1,loaded.naturalWidth||loaded.width||1000);
    imageEditorCanvas.height=Math.max(1,loaded.naturalHeight||loaded.height||700);
    imageEditSession={block,image:loaded,annotations,selected:-1,tool:'select',temp:null,gesture:null,scale:1,history:[JSON.stringify(annotations)],historyIndex:0};
    imageEditorFileName.textContent=img.alt||'Hình ảnh';
    imageEditorModal.hidden=false;imageEditorModal.setAttribute('aria-hidden','false');document.body.classList.add('image-editor-open');
    imageEditorSetTool('select');imageEditorSyncSelectedUI();imageEditorRefreshHistoryButtons();imageEditorUpdatePropertyLabels();
    requestAnimationFrame(()=>{imageEditorFit();drawImageEditor()});
  }catch(err){
    alert('Không thể mở trình chỉnh sửa ảnh: '+(err?.message||'Ảnh không hợp lệ.'));
  }
}

function closeImageEditor(force=false){
  if(!imageEditSession) return;
  const changed=imageEditorSnapshot() !== (imageEditSession.history[0] || '[]');
  if(!force && changed && !confirm('Ảnh đang có thay đổi chưa lưu. Bạn có muốn đóng và bỏ các thay đổi này?')) return;
  imageEditorModal.hidden=true;imageEditorModal.setAttribute('aria-hidden','true');document.body.classList.remove('image-editor-open');imageEditSession=null;
}

function saveImageEditor(){
  if(!imageEditSession) return;
  const block=imageEditSession.block;
  block.dataset.annotations=JSON.stringify(imageEditSession.annotations);
  renderImageAnnotationOverlay(block);
  persistRichContent();
  closeImageEditor(true);
}

function imageEditorDeleteSelected(push=true){
  if(!imageEditSession||imageEditSession.selected<0) return;
  imageEditSession.annotations.splice(imageEditSession.selected,1);imageEditSession.selected=-1;imageEditorSyncSelectedUI();drawImageEditor();if(push)imageEditorPushHistory();
}

function normalizeDrawEnd(a){
  if(!a) return null;
  if(['rect','ellipse'].includes(a.type) && Math.abs(a.x2-a.x1)<4 && Math.abs(a.y2-a.y1)<4) return null;
  if(a.type==='arrow' && Math.hypot(a.x2-a.x1,a.y2-a.y1)<6) return null;
  if(a.type==='free' && (!a.points||a.points.length<2)) return null;
  return a;
}

imageEditorCanvas.addEventListener('pointerdown',e=>{
  if(!imageEditSession) return;
  e.preventDefault();imageEditorCanvas.setPointerCapture?.(e.pointerId);
  const p=canvasPointFromEvent(e),tool=imageEditSession.tool,d=imageEditorDefaults();
  if(tool==='select'){
    const handle=selectedHandleAt(p.nx,p.ny);
    if(handle){
      imageEditSession.gesture={mode:'resize',handle,start:p,original:cloneJson(imageEditSession.annotations[imageEditSession.selected]),changed:false};return;
    }
    const hit=findAnnotationAt(p.nx,p.ny);imageEditSession.selected=hit;imageEditorSyncSelectedUI();
    if(hit>=0) imageEditSession.gesture={mode:'move',start:p,original:cloneJson(imageEditSession.annotations[hit]),changed:false};
    drawImageEditor();return;
  }
  if(tool==='eraser'){
    const hit=findAnnotationAt(p.nx,p.ny);if(hit>=0){imageEditSession.annotations.splice(hit,1);imageEditSession.selected=-1;imageEditorPushHistory();imageEditorSyncSelectedUI();drawImageEditor()}return;
  }
  if(tool==='text'){
    const value=prompt('Nhập nội dung chú thích:');if(value&&value.trim()){
      const a={type:'text',x:p.nx,y:p.ny,text:value.trim(),size:36,color:d.color,width:d.width,opacity:d.opacity};imageEditSession.annotations.push(a);imageEditSession.selected=imageEditSession.annotations.length-1;imageEditorPushHistory();imageEditorSyncSelectedUI();drawImageEditor();imageEditorSetTool('select');
    }return;
  }
  if(tool==='free'){
    imageEditSession.temp={type:'free',points:[[p.nx,p.ny]],color:d.color,width:d.width,opacity:d.opacity};imageEditSession.gesture={mode:'draw',start:p};return;
  }
  if(['rect','ellipse','arrow'].includes(tool)){
    imageEditSession.temp={type:tool,x1:p.nx,y1:p.ny,x2:p.nx,y2:p.ny,color:d.color,width:d.width,opacity:d.opacity,fillOpacity:d.fillOpacity};imageEditSession.gesture={mode:'draw',start:p};drawImageEditor();
  }
});

imageEditorCanvas.addEventListener('pointermove',e=>{
  if(!imageEditSession?.gesture) return;
  const p=canvasPointFromEvent(e),g=imageEditSession.gesture;
  if(g.mode==='draw'&&imageEditSession.temp){
    if(imageEditSession.temp.type==='free'){
      const pts=imageEditSession.temp.points,last=pts[pts.length-1];if(!last||Math.hypot(p.nx-last[0],p.ny-last[1])>1.5)pts.push([p.nx,p.ny]);
    }else{
      let nx=p.nx,ny=p.ny;
      if(e.shiftKey&&['rect','ellipse'].includes(imageEditSession.temp.type)){
        const dx=nx-g.start.nx,dy=ny-g.start.ny;const size=Math.max(Math.abs(dx),Math.abs(dy));nx=g.start.nx+Math.sign(dx||1)*size;ny=g.start.ny+Math.sign(dy||1)*size;
      }
      imageEditSession.temp.x2=nx;imageEditSession.temp.y2=ny;
    }
    drawImageEditor();return;
  }
  if(g.mode==='move'&&imageEditSession.selected>=0){
    const dx=p.nx-g.start.nx,dy=p.ny-g.start.ny;imageEditSession.annotations[imageEditSession.selected]=moveAnnotationFrom(g.original,dx,dy);g.changed=true;drawImageEditor();return;
  }
  if(g.mode==='resize'&&imageEditSession.selected>=0){
    imageEditSession.annotations[imageEditSession.selected]=resizeAnnotationFrom(g.original,g.handle,p.nx,p.ny);g.changed=true;drawImageEditor();
  }
});

imageEditorCanvas.addEventListener('pointerup',e=>{
  if(!imageEditSession?.gesture) return;
  const g=imageEditSession.gesture;
  if(g.mode==='draw'){
    const a=normalizeDrawEnd(imageEditSession.temp);imageEditSession.temp=null;if(a){imageEditSession.annotations.push(a);imageEditSession.selected=imageEditSession.annotations.length-1;imageEditorPushHistory();imageEditorSyncSelectedUI()}
  }else if((g.mode==='move'||g.mode==='resize')&&g.changed){imageEditorPushHistory();}
  imageEditSession.gesture=null;drawImageEditor();
});
imageEditorCanvas.addEventListener('pointercancel',()=>{if(imageEditSession){imageEditSession.temp=null;imageEditSession.gesture=null;drawImageEditor()}});

imageEditorStage.addEventListener('wheel',e=>{
  if(!imageEditSession||!e.ctrlKey) return;e.preventDefault();imageEditorApplyScale(imageEditSession.scale*(e.deltaY<0?1.12:.89));
},{passive:false});

document.querySelectorAll('[data-image-tool]').forEach(btn=>btn.addEventListener('click',()=>imageEditorSetTool(btn.dataset.imageTool)));
document.getElementById('imageEditorClose').onclick=closeImageEditor;
document.getElementById('imageEditorCancel').onclick=closeImageEditor;
document.getElementById('imageEditorSave').onclick=saveImageEditor;
imageEditUndoBtn.onclick=imageEditorUndo;imageEditRedoBtn.onclick=imageEditorRedo;
document.getElementById('imageEditClear').onclick=()=>{if(!imageEditSession||!imageEditSession.annotations.length)return;if(confirm('Xóa toàn bộ vùng đánh dấu trên ảnh này?')){imageEditSession.annotations=[];imageEditSession.selected=-1;imageEditorPushHistory();imageEditorSyncSelectedUI();drawImageEditor()}};
imageDeleteSelected.onclick=()=>imageEditorDeleteSelected(true);
document.getElementById('imageZoomIn').onclick=()=>imageEditSession&&imageEditorApplyScale(imageEditSession.scale*1.2);
document.getElementById('imageZoomOut').onclick=()=>imageEditSession&&imageEditorApplyScale(imageEditSession.scale/1.2);
document.getElementById('imageZoomFit').onclick=imageEditorFit;
document.getElementById('imageZoom100').onclick=()=>imageEditSession&&imageEditorApplyScale(1);

imageStrokeColor.addEventListener('input',()=>{imageStrokeHex.value=imageStrokeColor.value.toUpperCase();imageEditorApplyPropsToSelected(false)});
imageStrokeColor.addEventListener('change',()=>imageEditorApplyPropsToSelected(true));
imageStrokeHex.addEventListener('change',()=>{const rgb=hexToRgb(imageStrokeHex.value);if(rgb){imageStrokeColor.value=rgbToHex(rgb.r,rgb.g,rgb.b).toLowerCase();imageEditorApplyPropsToSelected(true)}else imageStrokeHex.value=imageStrokeColor.value.toUpperCase()});
[imageStrokeWidth,imageOpacity,imageFillOpacity].forEach(input=>{
  input.addEventListener('input',()=>imageEditorApplyPropsToSelected(false));
  input.addEventListener('change',()=>imageEditorApplyPropsToSelected(true));
});
// -----------------------------------------------------------------------------

richEditor.addEventListener('input', () => { saveRichSelection(); persistRichContent(); });
richEditor.addEventListener('keyup', () => { saveRichSelection(); refreshToolbarState(); });
richEditor.addEventListener('mouseup', () => { saveRichSelection(); refreshToolbarState(); });
richEditor.addEventListener('focus', saveRichSelection);

document.addEventListener('selectionchange', () => {
  const sel = window.getSelection();
  if(sel && sel.rangeCount && richEditor.contains(sel.anchorNode)){
    saveRichSelection();
    refreshToolbarState();
  }
});

document.querySelectorAll('.rich-btn[data-command]').forEach(btn => {
  btn.addEventListener('mousedown', e => e.preventDefault());
  btn.addEventListener('click', () => runRichCommand(btn.dataset.command));
});

document.getElementById('blockFormat').addEventListener('change', e => runRichCommand('formatBlock', `<${e.target.value}>`));
document.getElementById('fontName').addEventListener('change', e => runRichCommand('fontName', e.target.value));
document.getElementById('fontSize').addEventListener('change', e => {
  const px = Number(e.target.value);
  const map = px <= 12 ? 2 : px <= 16 ? 3 : px <= 18 ? 4 : px <= 24 ? 5 : px <= 32 ? 6 : 7;
  runRichCommand('fontSize', String(map));
});
document.getElementById('textColor').addEventListener('input', e => runRichCommand('foreColor', e.target.value));
document.getElementById('highlightColor').addEventListener('input', e => {
  restoreRichSelection();
  if(!document.execCommand('hiliteColor', false, e.target.value)) document.execCommand('backColor', false, e.target.value);
  saveRichSelection(); persistRichContent(); refreshToolbarState();
});
document.getElementById('linkBtn').addEventListener('mousedown', e => e.preventDefault());
document.getElementById('linkBtn').addEventListener('click', () => {
  restoreRichSelection();
  const url = prompt('Nhập địa chỉ liên kết (https://...)');
  if(url) runRichCommand('createLink', url);
});

imageBtn.addEventListener('mousedown', e => {
  e.preventDefault();
  saveRichSelection();
});
imageBtn.addEventListener('click', () => {
  if(!selected) return;
  imageFileInput.value = '';
  imageFileInput.click();
});
imageFileInput.addEventListener('change', async () => {
  const file = imageFileInput.files && imageFileInput.files[0];
  if(file) await insertImageFile(file);
  imageFileInput.value = '';
});

attachmentBtn.addEventListener('mousedown', e => {
  e.preventDefault();
  saveRichSelection();
});
attachmentBtn.addEventListener('click', () => {
  if(!selected) return;
  attachmentFileInput.value = '';
  attachmentFileInput.click();
});
attachmentFileInput.addEventListener('change', async () => {
  const files = [...(attachmentFileInput.files || [])];
  attachmentFileInput.value = '';
  for(const file of files){
    try{
      await insertAttachmentFile(file);
    }catch(err){
      alert(err?.message || `Không thể tải file ${file.name || ''}.`);
    }
  }
});

richEditor.addEventListener('paste', async e => {
  const items = [...(e.clipboardData?.items || [])];
  const imageItem = items.find(item => item.kind === 'file' && /^image\/(png|jpeg|webp)$/i.test(item.type || ''));
  if(!imageItem) return;
  const file = imageItem.getAsFile();
  if(!file) return;
  e.preventDefault();
  saveRichSelection();
  await insertImageFile(file);
});

richEditor.addEventListener('click', e => {
  const clickedImageBlock = e.target.closest('.image-block');
  richEditor.querySelectorAll('.image-block-selected').forEach(block => { if(block !== clickedImageBlock) block.classList.remove('image-block-selected'); });
  if(clickedImageBlock) clickedImageBlock.classList.add('image-block-selected');

  const editImageBtn = e.target.closest('[data-edit-image]');
  if(editImageBtn){
    e.preventDefault();
    e.stopPropagation();
    const block = editImageBtn.closest('.image-block');
    if(block) openImageEditor(block);
    return;
  }

  const removeFileBtn = e.target.closest('[data-remove-file]');
  if(removeFileBtn){
    e.preventDefault();
    e.stopPropagation();
    const block = removeFileBtn.closest('.file-block');
    if(block){
      const range = document.createRange();
      if(block.nextSibling){
        range.setStartBefore(block.nextSibling);
        range.collapse(true);
      }else{
        range.selectNodeContents(richEditor);
        range.collapse(false);
      }
      block.remove();
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      savedRichRange = range.cloneRange();
      persistRichContent();
      refreshToolbarState();
    }
    return;
  }

  const removeBtn = e.target.closest('[data-remove-image]');
  if(removeBtn){
    e.preventDefault();
    e.stopPropagation();
    const block = removeBtn.closest('.image-block');
    if(block){
      const range = document.createRange();
      if(block.nextSibling){
        range.setStartBefore(block.nextSibling);
        range.collapse(true);
      }else{
        range.selectNodeContents(richEditor);
        range.collapse(false);
      }
      block.remove();
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      savedRichRange = range.cloneRange();
      persistRichContent();
      refreshToolbarState();
    }
    return;
  }

  const fileLink = e.target.closest('.file-name');
  if(fileLink && richEditor.contains(fileLink)){
    e.stopPropagation();
    return;
  }

  const selectableBlock = e.target.closest('.image-block,.file-block');
  if(selectableBlock && richEditor.contains(selectableBlock)){
    const range = document.createRange();
    range.selectNode(selectableBlock);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    savedRichRange = range.cloneRange();
  }
});

for(const c of colors){
  const sw = document.createElement('button');
  sw.className = 'sw';
  sw.style.background = c;
  sw.title = c;
  sw.onclick = () => applyNoteColor(c);
  document.getElementById('colors').appendChild(sw);
}

function applyRgbInputs(){
  applyNoteColor(rgbToHex(rgbR.value, rgbG.value, rgbB.value));
}
[rgbR,rgbG,rgbB].forEach(input => input.addEventListener('input', applyRgbInputs));
noteColorPicker.addEventListener('input', e => applyNoteColor(e.target.value));
hexColor.addEventListener('change', () => {
  const rgb = hexToRgb(hexColor.value);
  if(rgb) applyNoteColor(rgbToHex(rgb.r,rgb.g,rgb.b));
  else updateRgbControls(nodeBy(selected)?.color || '#8b5cf6');
});

document.getElementById('deleteBtn').onclick = () => {
  if(!selected) return;
  moveNodeToTrash(selected);
};

document.getElementById('deleteEdgeBtn').onclick = () => {
  if(selectedEdge) removeEdge(selectedEdge);
};

function applySearchFilter(){
  const q = searchInput.value.toLowerCase().trim();
  document.querySelectorAll('.node').forEach(el => {
    const n = nodeBy(el.dataset.id);
    el.style.display = !q || (`${n.title} ${plainContent(n)} ${n.tag}`).toLowerCase().includes(q) ? 'block' : 'none';
  });
  if(activeView === 'notes') renderAllNotes();
  if(activeView === 'trash') renderTrash();
}

searchInput.oninput = applySearchFilter;


document.querySelectorAll('.view-nav').forEach(nav => {
  nav.addEventListener('click', () => setView(nav.dataset.view));
});
document.getElementById('addFromTable').onclick = addNote;
restoreSelectedBtn.onclick = () => restoreTrashItems([...selectedTrash]);

function isTextEditing(){
  const el = document.activeElement;
  return !!el && (['INPUT','TEXTAREA','SELECT'].includes(el.tagName) || el.isContentEditable);
}

window.onkeydown = e => {
  if(imageEditSession){
    if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z'){
      e.preventDefault();
      if(e.shiftKey) imageEditorRedo(); else imageEditorUndo();
      return;
    }
    if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y'){
      e.preventDefault();
      imageEditorRedo();
      return;
    }
    if(e.key === 'Delete' || e.key === 'Backspace'){
      if(!['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)){
        e.preventDefault();
        imageEditorDeleteSelected(true);
        return;
      }
    }
    if(e.key === 'Escape'){
      e.preventDefault();
      closeImageEditor();
      return;
    }
  }
  const workspaceActive = workspaceApp.style.display !== 'none';
  if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && workspaceActive){
    e.preventDefault();
    saveProjectToDisk();
    return;
  }
  if(!workspaceActive) return;
  if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z'){
    e.preventDefault();
    if(e.shiftKey) redoHistory(); else undoHistory();
    return;
  }
  if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y'){
    e.preventDefault();
    redoHistory();
    return;
  }
  if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k'){
    e.preventDefault();
    searchInput.focus();
  }
  if(e.key.toLowerCase() === 'n' && !isTextEditing()) addNote();
  if((e.key === 'Delete' || e.key === 'Backspace') && !isTextEditing()){
    if(selected){
      document.getElementById('deleteBtn').click();
    }else if(selectedEdge){
      removeEdge(selectedEdge);
    }
  }
  if(e.key === 'Escape' && linkStart){
    highlightHandle(linkStart.originalNodeId || linkStart.nodeId, linkStart.originalHandleId || linkStart.handleId, false);
    clearTargetHighlights();
    document.body.classList.remove('is-linking');
    linkStart = null;
    linkPointer = null;
    drawEdges();
  }
};

newProjectBtn.onclick = startNewProject;
openProjectBtn.onclick = () => projectFileInput.click();
projectFileInput.addEventListener('change', () => {
  const file = projectFileInput.files && projectFileInput.files[0];
  if(file) openProjectFile(file);
});
saveFileBtn.onclick = saveProjectToDisk;
homeBtn.onclick = () => {
  if(fileDirty && !confirm('Dự án đang có thay đổi chưa lưu ra file. Vẫn quay về trang đầu?')) return;
  showLanding();
};
window.addEventListener('beforeunload', e => {
  if(fileDirty){ e.preventDefault(); e.returnValue = ''; }
});

resetHistory();
render();
setView('overview');
showLanding();
