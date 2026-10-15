/* ============================================================
   PROJETO EDUCACIONAL 7.0 — CONSOLIDADO
   ============================================================ */

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const STORAGE_KEY = "projetoEducacional7";
const SESSION_KEY = "projetoEducacional7Session";
const MASTER_KEY = "MDplano32026";

const state = {
  role:null,
  professor:null,
  student:null,
  currentClass:null,
  currentContext:null,
  currentActivity:null,
  activeSeconds:0,
  timerHandle:null,
  heartbeatHandle:null,
  reportRows:[],
  pendingImport:null,
  studentContextSlug:null,
  materialBoard:null,
  classObservationDraft:null,
  scratchHistoryTimer:null,
  scratchSaveDebounced:null
};

const screens = [
  "screenLanding",
  "screenProfessorAuth",
  "screenStudentAuth",
  "screenProfessorHome",
  "screenWorkspace",
  "screenProfessorProfile",
  "screenStudentDashboard",
  "screenStudentActivity",
  "screenMaterialLab"
];

/*
  NOMES EXATOS DAS IMAGENS NA RAIZ DO GITHUB:
  adicao.jpg
  subtracao.jpg
  multiplicacao.jpg
  divisao.jpg
  educacao-financeira.jpg
  linguagens.jpg
  ciencias-humanas.jpg
  ciencias-natureza.jpg
  temas-transversais.jpg
  educacao-digital.jpg
  projeto-de-vida.jpg
*/
const STREAMING_ROWS = [
  {
    title:"Matemática",
    items:[
      {title:"Adição",image:"adicao.jpg",subtitle:"Laboratório de Adição",area:"Matemática",module:"Adição",slug:"adicao"},
      {title:"Subtração",image:"subtracao.jpg",subtitle:"Laboratório de Subtração",area:"Matemática",module:"Subtração",slug:"subtracao"},
      {title:"Multiplicação",image:"multiplicacao.jpg",subtitle:"Laboratório de Multiplicação",area:"Matemática",module:"Multiplicação",slug:"multiplicacao"},
      {title:"Divisão",image:"divisao.jpg",subtitle:"Laboratório da Divisão",area:"Matemática",module:"Divisão",slug:"divisao"},
      {title:"Educação Financeira",image:"educacao-financeira.jpg",subtitle:"Situações financeiras e porcentagem",area:"Matemática",module:"Educação Financeira",slug:"educacao-financeira"}
    ]
  },
  {
    title:"Áreas do Conhecimento",
    items:[
      {title:"Linguagens",image:"linguagens.jpg",subtitle:"Português, Literatura, Arte e Inglês",area:"Linguagens",slug:"linguagens"},
      {title:"Ciências Humanas",image:"ciencias-humanas.jpg",subtitle:"Filosofia, História, Geografia e Sociologia",area:"Ciências Humanas",slug:"ciencias-humanas"},
      {title:"Ciências da Natureza",image:"ciencias-natureza.jpg",subtitle:"Biologia, Física e Química",area:"Ciências da Natureza",slug:"ciencias-natureza"},
      {title:"Temas Transversais",image:"temas-transversais.jpg",subtitle:"Integrações entre áreas e componentes",area:"Temas Transversais",slug:"temas-transversais"}
    ]
  },
  {
    title:"Educação, Tecnologia e Projeto Pessoal",
    items:[
      {title:"Educação Digital / Computação",image:"educacao-digital.jpg",subtitle:"Pensamento computacional, lógica e programação",area:"Educação Digital / Computação",slug:"educacao-digital"},
      {title:"Projeto de Vida",image:"projeto-de-vida.jpg",subtitle:"Autoconhecimento, planejamento e mundo do trabalho",area:"Projeto de Vida",slug:"projeto-de-vida"}
    ]
  }
];

/* ============================================================
   DADOS LOCAIS
   ============================================================ */
function defaultData(){
  return {
    professors:[],
    classes:[],
    students:[],
    activities:[],
    assignments:[],
    submissions:[]
  };
}

function loadData(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? {...defaultData(),...JSON.parse(raw)} : defaultData();
  }catch{
    return defaultData();
  }
}

function saveData(data){
  localStorage.setItem(STORAGE_KEY,JSON.stringify(data));
}

function getSession(){
  try{
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
  }catch{
    return null;
  }
}

function setSession(value){
  if(value){
    sessionStorage.setItem(SESSION_KEY,JSON.stringify(value));
  }else{
    sessionStorage.removeItem(SESSION_KEY);
  }
}

function uid(prefix="id"){
  if(window.crypto?.randomUUID){
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,10)}`;
}

async function hashText(value){
  if(window.crypto?.subtle){
    const bytes = new TextEncoder().encode(String(value));
    const hash = await crypto.subtle.digest("SHA-256",bytes);
    return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2,"0")).join("");
  }
  return btoa(unescape(encodeURIComponent(String(value))));
}

/* ============================================================
   UTILITÁRIOS
   ============================================================ */
function showScreen(id){
  screens.forEach(screenId => {
    const el = document.getElementById(screenId);
    if(el) el.classList.toggle("active",screenId === id);
  });
  window.scrollTo({top:0,behavior:"smooth"});
}

function setTopbar(show,role=null){
  $("#topbar").classList.toggle("hidden",!show);
  $("#professorNav").classList.toggle("hidden",role !== "professor");
  $("#studentNav").classList.toggle("hidden",role !== "student");
}

function toast(message,type="info",timeout=4200){
  const el = $("#toast");
  el.textContent = message;
  el.className = `toast ${type}`;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.add("hidden"),timeout);
}

function escapeHtml(value){
  return String(value ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function normalizeClassCode(value){
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g,"-")
    .replace(/[^A-Z0-9_-]/g,"");
}

function parseStudentName(value){
  const raw = String(value ?? "").trim();
  const match = raw.match(/^(\d{2})\s*\.\s*(.+)$/u);

  if(!match){
    return {
      valid:false,
      message:"O nome do aluno deve começar com dois algarismos, ponto e nome. Ex.: 03. André Paulo."
    };
  }

  const roster = Number(match[1]);
  const plainName = match[2].replace(/\s+/g," ").trim();

  if(!plainName || plainName.length < 2){
    return {valid:false,message:"Informe o nome do aluno após o número da chamada."};
  }

  return {
    valid:true,
    roster,
    rosterText:String(roster).padStart(2,"0"),
    plainName,
    fullName:`${String(roster).padStart(2,"0")}. ${plainName}`
  };
}

function makeRandomClassCode(){
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "T-";
  for(let i=0;i<6;i++){
    result += chars[Math.floor(Math.random()*chars.length)];
  }
  return result;
}

function formatDateTime(value){
  if(!value) return "—";
  try{
    return new Intl.DateTimeFormat("pt-BR",{
      dateStyle:"short",
      timeStyle:"short"
    }).format(new Date(value));
  }catch{
    return "—";
  }
}

function formatDuration(totalSeconds){
  const seconds = Math.max(0,Math.floor(Number(totalSeconds)||0));
  const h = Math.floor(seconds/3600);
  const m = Math.floor((seconds%3600)/60);
  const s = seconds%60;

  if(h>0){
    return `${h}h ${String(m).padStart(2,"0")}min ${String(s).padStart(2,"0")}s`;
  }
  return `${m}min ${String(s).padStart(2,"0")}s`;
}

function timerText(totalSeconds){
  const seconds = Math.max(0,Math.floor(Number(totalSeconds)||0));
  const h = Math.floor(seconds/3600);
  const m = Math.floor((seconds%3600)/60);
  const s = seconds%60;

  if(h>0){
    return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
  }
  return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}

function debounce(fn,delay){
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args),delay);
  };
}

function initialsFromName(name){
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if(!parts.length) return "PE";
  if(parts.length === 1) return parts[0].slice(0,2).toUpperCase();
  return `${parts[0][0]}${parts.at(-1)[0]}`.toUpperCase();
}

function setTopbarIdentity(name,roleLabel){
  $("#topbarUserName").textContent = name || "";
  $("#topbarAvatar").textContent = initialsFromName(name);
  $("#topbarRole").textContent = roleLabel || "";
}

function setActiveTopNav(nav){
  $$("[data-nav]").forEach(button => {
    button.classList.toggle("active",button.dataset.nav === nav);
  });

  $$("[data-student-nav]").forEach(button => {
    button.classList.toggle("active",nav === "student-dashboard");
  });
}

function metricCard(label,value,detail="",tone="blue"){
  return `
    <article class="metric-card metric-${tone}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      ${detail ? `<small>${escapeHtml(detail)}</small>` : ""}
    </article>
  `;
}

function professorOwnedData(){
  const data = loadData();
  const classes = data.classes.filter(c => c.professorId === state.professor?.id);
  const classIds = new Set(classes.map(c => c.id));
  const activities = data.activities.filter(a => a.professorId === state.professor?.id);
  const activityIds = new Set(activities.map(a => a.id));
  const students = data.students.filter(s => classIds.has(s.classId));
  const submissions = data.submissions.filter(s =>
    classIds.has(s.classId) && activityIds.has(s.activityId)
  );

  return {data,classes,activities,students,submissions,classIds,activityIds};
}

function renderProfessorHeroStats(){
  const host = $("#professorHeroStats");
  if(!host || !state.professor) return;

  const {classes,activities,students,submissions} = professorOwnedData();
  const activeStudents = new Set(submissions.map(s => s.studentId)).size;

  host.innerHTML = [
    metricCard("Turmas",String(classes.length),"organizadas","blue"),
    metricCard("Alunos",String(students.length),"cadastrados","green"),
    metricCard("Atividades",String(activities.length),"no banco","gold"),
    metricCard("Participaram",String(activeStudents),"com acesso registrado","violet")
  ].join("");
}

function renderOverviewMetrics(){
  const host = $("#overviewMetrics");
  if(!host || !state.professor || !state.currentContext) return;

  const {data,classes,students} = professorOwnedData();

  const contextActivities = data.activities.filter(a =>
    a.professorId === state.professor.id &&
    a.contextSlug === state.currentContext.slug
  );

  const contextActivityIds = new Set(contextActivities.map(a => a.id));

  const assignments = data.assignments.filter(a =>
    contextActivityIds.has(a.activityId)
  );

  const submissions = data.submissions.filter(s =>
    contextActivityIds.has(s.activityId)
  );

  const participatingStudents = new Set(submissions.map(s => s.studentId)).size;

  host.innerHTML = [
    metricCard("Turmas",String(classes.length),"disponíveis para esta área","blue"),
    metricCard("Atividades",String(contextActivities.length),state.currentContext.title,"gold"),
    metricCard("Liberações",String(assignments.length),"atividades atribuídas","violet"),
    metricCard("Participação",String(participatingStudents),`de ${students.length} alunos cadastrados`,"green")
  ].join("");
}

function emptyState(icon,title,text,actionLabel="",actionAttr=""){
  return `
    <div class="empty-state">
      <div class="empty-icon" aria-hidden="true">${icon}</div>
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(text)}</p>
      ${actionLabel ? `<button class="btn btn-primary" type="button" ${actionAttr}>${escapeHtml(actionLabel)}</button>` : ""}
    </div>
  `;
}

function normalizeActivityRow(row){
  const normalized = {};

  Object.entries(row).forEach(([key,value]) => {
    normalized[
      String(key)
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g,"")
        .replace(/\s+/g,"_")
    ] = value;
  });

  return {
    title:String(normalized.titulo || normalized.title || "").trim(),
    statement:String(normalized.enunciado || normalized.statement || "").trim(),
    question:String(normalized.pergunta || normalized.question || "").trim(),
    answer:String(normalized.resposta || normalized.answer || "").trim(),
    level:String(normalized.nivel || normalized.level || "").trim(),
    type:String(normalized.tipo || normalized.type || "problem_situation").trim(),
    operandA:normalized.operando_a ?? normalized.dividendo ?? "",
    operandB:normalized.operando_b ?? normalized.divisor ?? "",
    unit:String(normalized.unidade || normalized.unit || "").trim()
  };
}


/* ============================================================
   MOSTRAR / OCULTAR SENHAS
   ============================================================ */
function setupPasswordToggles(){
  $$("[data-password-toggle]").forEach(button => {
    button.addEventListener("click",() => {
      const field = button.closest(".password-field");
      const input = field?.querySelector("input");
      if(!input) return;

      const visible = input.type === "text";
      input.type = visible ? "password" : "text";
      button.textContent = visible ? "Mostrar" : "Ocultar";
      button.setAttribute("aria-label",visible ? "Mostrar senha" : "Ocultar senha");
    });
  });
}

/* ============================================================
   AUTENTICAÇÃO LOCAL
   ============================================================ */
async function professorRegister(event){
  event.preventDefault();

  const name = $("#profRegisterName").value.trim();
  const username = $("#profRegisterUsername").value.trim();
  const password = $("#profRegisterPassword").value;
  const password2 = $("#profRegisterPassword2").value;
  const masterKey = $("#profRegisterMasterKey").value;

  if(name.length < 2) return toast("Informe o nome do professor.","error");
  if(username.length < 2) return toast("Informe um usuário válido.","error");
  if(password.length < 8) return toast("A senha deve ter pelo menos 8 caracteres.","error");
  if(password !== password2) return toast("As senhas não coincidem.","error");
  if(masterKey !== MASTER_KEY) return toast("Chave geral inválida.","error");

  const data = loadData();

  if(data.professors.some(p => p.username.toLowerCase() === username.toLowerCase())){
    return toast("Este usuário já está cadastrado.","error");
  }

  const professor = {
    id:uid("prof"),
    name,
    username,
    passwordHash:await hashText(password),
    accessKeyHash:await hashText(MASTER_KEY),
    requireAdminKey:false,
    createdAt:new Date().toISOString()
  };

  data.professors.push(professor);
  saveData(data);

  state.role = "professor";
  state.professor = professor;
  setSession({role:"professor",userId:professor.id});

  event.target.reset();
  toast("Perfil do professor criado com sucesso.","success");
  await enterProfessorArea();
}

async function professorLogin(event){
  event.preventDefault();

  const username = $("#profLoginUsername").value.trim();
  const passwordHash = await hashText($("#profLoginPassword").value);
  const data = loadData();

  const professor = data.professors.find(p =>
    p.username.toLowerCase() === username.toLowerCase() &&
    p.passwordHash === passwordHash
  );

  if(!professor){
    return toast("Usuário ou senha inválidos.","error");
  }

  state.role = "professor";
  state.professor = professor;
  setSession({role:"professor",userId:professor.id});

  await enterProfessorArea();
}

async function studentRegister(event){
  event.preventDefault();

  const classCode = normalizeClassCode($("#studentRegisterClassCode").value);
  const parsed = parseStudentName($("#studentRegisterName").value);
  const password = $("#studentRegisterPassword").value;
  const password2 = $("#studentRegisterPassword2").value;

  if(!parsed.valid) return toast(parsed.message,"error");
  if(password.length < 8) return toast("A senha deve ter pelo menos 8 caracteres.","error");
  if(password !== password2) return toast("As senhas não coincidem.","error");

  const data = loadData();
  const classItem = data.classes.find(c => c.code === classCode);

  if(!classItem) return toast("Código de turma não encontrado.","error");

  const duplicate = data.students.some(s =>
    s.classId === classItem.id &&
    s.roster === parsed.roster
  );

  if(duplicate){
    return toast(`O número ${parsed.rosterText} já está cadastrado nesta turma.`,"error");
  }

  const student = {
    id:uid("student"),
    classId:classItem.id,
    name:parsed.fullName,
    plainName:parsed.plainName,
    roster:parsed.roster,
    rosterText:parsed.rosterText,
    passwordHash:await hashText(password),
    status:"Ativo",
    createdAt:new Date().toISOString(),
    firstAccess:new Date().toISOString(),
    lastAccess:new Date().toISOString()
  };

  data.students.push(student);
  saveData(data);

  state.role = "student";
  state.student = student;
  state.currentClass = classItem;
  setSession({role:"student",userId:student.id});

  event.target.reset();
  toast("Acesso do aluno criado com sucesso.","success");
  showStudentDashboard();
}

async function studentLogin(event){
  event.preventDefault();

  const classCode = normalizeClassCode($("#studentLoginClassCode").value);
  const rosterText = String($("#studentLoginRoster").value).replace(/\D/g,"").padStart(2,"0");
  const roster = Number(rosterText);
  const passwordHash = await hashText($("#studentLoginPassword").value);

  const data = loadData();
  const classItem = data.classes.find(c => c.code === classCode);

  if(!classItem) return toast("Código de turma não encontrado.","error");

  const student = data.students.find(s =>
    s.classId === classItem.id &&
    s.roster === roster &&
    s.passwordHash === passwordHash
  );

  if(!student) return toast("Número da chamada ou senha inválidos.","error");

  student.lastAccess = new Date().toISOString();
  saveData(data);

  state.role = "student";
  state.student = student;
  state.currentClass = classItem;
  setSession({role:"student",userId:student.id});

  showStudentDashboard();
}

async function restoreSession(){
  const session = getSession();
  if(!session) return;

  const data = loadData();

  if(session.role === "professor"){
    const professor = data.professors.find(p => p.id === session.userId);
    if(!professor) return;
    state.role = "professor";
    state.professor = professor;
    await enterProfessorArea();
    return;
  }

  if(session.role === "student"){
    const student = data.students.find(s => s.id === session.userId);
    if(!student) return;
    state.role = "student";
    state.student = student;
    state.currentClass = data.classes.find(c => c.id === student.classId) || null;
    showStudentDashboard();
  }
}

function logout(){
  stopActivityTimer(true);
  setSession(null);

  state.role = null;
  state.professor = null;
  state.student = null;
  state.currentClass = null;
  state.currentContext = null;
  state.currentActivity = null;

  setTopbar(false);
  showScreen("screenLanding");
}

async function enterProfessorArea(){
  const data = loadData();
  const fresh = data.professors.find(p => p.id === state.professor.id);
  if(fresh) state.professor = fresh;

  setTopbarIdentity(state.professor.name,"Professor");
  setTopbar(true,"professor");

  if(state.professor.requireAdminKey){
    $("#adminGateKey").value = "";
    $("#adminGateModal").classList.remove("hidden");
    return;
  }

  showProfessorHome();
}

async function submitAdminGate(event){
  event.preventDefault();

  const typedHash = await hashText($("#adminGateKey").value);
  const data = loadData();
  const professor = data.professors.find(p => p.id === state.professor.id);

  if(!professor || professor.accessKeyHash !== typedHash){
    return toast("Chave pessoal inválida.","error");
  }

  $("#adminGateModal").classList.add("hidden");
  showProfessorHome();
}

/* ============================================================
   STREAMING
   ============================================================ */
function showProfessorHome(){
  $("#professorWelcome").textContent = `Olá, ${state.professor.name}.`;
  setTopbarIdentity(state.professor.name,"Professor");
  setActiveTopNav("home");
  renderProfessorHeroStats();
  renderStreamingRows();
  setTopbar(true,"professor");
  showScreen("screenProfessorHome");
}

function renderStreamingRows(){
  const container = $("#streamingRows");
  container.innerHTML = "";

  STREAMING_ROWS.forEach(row => {
    const section = document.createElement("section");
    section.className = "stream-row";

    section.innerHTML = `
      <div class="stream-row-heading">
        <h2>${escapeHtml(row.title)}</h2>
      </div>
      <div class="cover-grid"></div>
    `;

    const grid = $(".cover-grid",section);

    row.items.forEach(item => {
      const wrapper = document.createElement("article");
      wrapper.className = "cover-item";

      wrapper.innerHTML = `
        <button class="cover-card" type="button" aria-label="Abrir ${escapeHtml(item.title)}">
          <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" loading="lazy">
          <div class="cover-fallback hidden" aria-hidden="true">
            <span>${escapeHtml(item.title)}</span>
          </div>
        </button>

        <div class="cover-info">
          <div>
            <strong>${escapeHtml(item.title)}</strong>
            <small>${escapeHtml(item.subtitle || "")}</small>
          </div>
          <span class="cover-action">Abrir área →</span>
        </div>
      `;

      const button = $(".cover-card",wrapper);
      const img = $("img",wrapper);
      const fallback = $(".cover-fallback",wrapper);

      img.addEventListener("load",() => fallback.classList.add("hidden"));
      img.addEventListener("error",() => {
        img.classList.add("hidden");
        fallback.classList.remove("hidden");
      });

      button.addEventListener("click",() => openWorkspace(item));
      grid.appendChild(wrapper);
    });

    container.appendChild(section);
  });
}

function openWorkspace(context){
  state.currentContext = {...context};

  $("#workspaceTitle").textContent = context.title;
  $("#workspaceSubtitle").textContent = context.subtitle || "";

  $("#activityContextSummary").innerHTML = `
    <strong>${escapeHtml(context.title)}</strong>
    <span>${escapeHtml(context.subtitle || "")}</span>
  `;

  populateClassSelects();
  renderClassList();
  renderActivityList();
  renderOverviewMetrics();

  setWorkspaceTab("overview");
  showScreen("screenWorkspace");
}

function setWorkspaceTab(tab){
  $$(".workspace-tab").forEach(button => {
    button.classList.toggle("active",button.dataset.workTab === tab);
  });

  $$(".workspace-panel").forEach(panel => panel.classList.remove("active"));

  const map = {
    overview:"#workOverview",
    classes:"#workClasses",
    activities:"#workActivities",
    upload:"#workUpload",
    reports:"#workReports"
  };

  $(map[tab])?.classList.add("active");

  if(tab === "overview"){
    setActiveTopNav("home");
    renderOverviewMetrics();
  }

  if(tab === "classes"){
    setActiveTopNav("classes");
    renderClassList();
  }

  if(tab === "activities"){
    setActiveTopNav("activities");
    renderActivityList();
  }

  if(tab === "upload"){
    setActiveTopNav("activities");
    populateClassSelects();
  }

  if(tab === "reports"){
    setActiveTopNav("reports");
    prepareReports();
  }
}

function emptyClassObservationData(){
  return {
    studentCount:0,
    profile:"",
    strategies:"",
    resources:""
  };
}

function normalizeClassObservationData(value){
  return {
    studentCount:Math.max(0,Number(value?.studentCount || 0)),
    profile:String(value?.profile || ""),
    strategies:String(value?.strategies || ""),
    resources:String(value?.resources || "")
  };
}

function classObservationHasContent(value){
  const data = normalizeClassObservationData(value);
  return data.studentCount > 0 || Boolean(data.profile.trim() || data.strategies.trim() || data.resources.trim());
}

function setClassObservationSummary(value){
  const host = $("#classObservationSummary");
  if(!host) return;

  const data = normalizeClassObservationData(value);
  if(!classObservationHasContent(data)){
    host.innerHTML = `Nenhuma observação pedagógica detalhada registrada.`;
    return;
  }

  host.innerHTML = `
    <strong>${data.studentCount}</strong> aluno(s) sinalizado(s) para adaptações
    <span>•</span>
    <span>Informações pedagógicas registradas</span>
  `;
}

function openClassObservations(classId=null){
  const data = loadData();
  let observations = state.classObservationDraft || emptyClassObservationData();
  let title = "Nova turma";

  if(classId){
    const item = data.classes.find(c => c.id === classId && c.professorId === state.professor.id);
    if(!item) return;
    observations = normalizeClassObservationData(item.supportObservations);
    title = item.name || "Turma";
    $("#classObservationsTargetId").value = classId;
  }else{
    const editId = $("#classEditId")?.value || "";
    if(editId && !state.classObservationDraft){
      const item = data.classes.find(c => c.id === editId && c.professorId === state.professor.id);
      if(item){
        observations = normalizeClassObservationData(item.supportObservations);
        title = item.name || "Turma";
      }
    }else{
      title = $("#className")?.value.trim() || "Nova turma";
    }
    $("#classObservationsTargetId").value = "";
  }

  $("#classObservationsTitle").textContent = `Observações da turma — ${title}`;
  $("#classSupportStudentCount").value = observations.studentCount || 0;
  $("#classSupportProfile").value = observations.profile || "";
  $("#classSupportStrategies").value = observations.strategies || "";
  $("#classSupportResources").value = observations.resources || "";
  $("#classObservationsModal").classList.remove("hidden");
}

function closeClassObservations(){
  $("#classObservationsModal").classList.add("hidden");
}

function getClassObservationsFromModal(){
  return normalizeClassObservationData({
    studentCount:$("#classSupportStudentCount").value,
    profile:$("#classSupportProfile").value.trim(),
    strategies:$("#classSupportStrategies").value.trim(),
    resources:$("#classSupportResources").value.trim()
  });
}

function saveClassObservations(){
  const observations = getClassObservationsFromModal();
  const targetId = $("#classObservationsTargetId").value;

  if(targetId){
    const data = loadData();
    const item = data.classes.find(c => c.id === targetId && c.professorId === state.professor.id);
    if(!item) return;
    item.supportObservations = observations;
    saveData(data);
    renderClassList();
    toast("Observações da turma salvas.","success");
  }else{
    state.classObservationDraft = observations;
    setClassObservationSummary(observations);
    toast("Observações registradas para esta turma.","success");
  }

  closeClassObservations();
}

function clearClassObservationsFields(){
  $("#classSupportStudentCount").value = 0;
  $("#classSupportProfile").value = "";
  $("#classSupportStrategies").value = "";
  $("#classSupportResources").value = "";
}

/* ============================================================
   TURMAS
   ============================================================ */
function currentProfessorClasses(){
  const data = loadData();
  return data.classes.filter(c => c.professorId === state.professor.id);
}

function populateClassSelects(){
  const classes = currentProfessorClasses();

  [
    ["#uploadAssignClass","Somente banco do professor"],
    ["#reportClassSelect","Selecione uma turma"]
  ].forEach(([selector,placeholder]) => {
    const select = $(selector);
    if(!select) return;

    const previous = select.value;

    select.innerHTML = `<option value="">${placeholder}</option>` +
      classes.map(item =>
        `<option value="${item.id}">${escapeHtml(item.name)}</option>`
      ).join("");

    if(classes.some(item => item.id === previous)){
      select.value = previous;
    }
  });
}

function saveClass(event){
  event.preventDefault();

  const data = loadData();
  const editId = $("#classEditId").value;

  const payload = {
    name:$("#className").value.trim(),
    grade:$("#classGrade").value.trim(),
    schoolYear:Number($("#classYear").value) || null,
    code:normalizeClassCode($("#classCode").value),
    supportObservations:normalizeClassObservationData(state.classObservationDraft),
    levels:$$('input[name="classLevel"]:checked').map(input => input.value)
  };

  if(!payload.name) return toast("Informe o nome da turma.","error");
  if(!payload.code) return toast("Informe um código de acesso.","error");
  if(!payload.levels.length) return toast("Selecione pelo menos um nível.","error");

  const duplicateCode = data.classes.some(item =>
    item.code === payload.code &&
    item.id !== editId
  );

  if(duplicateCode) return toast("Este código de turma já está em uso.","error");

  if(editId){
    const item = data.classes.find(c =>
      c.id === editId &&
      c.professorId === state.professor.id
    );

    if(!item) return;
    Object.assign(item,payload);
  }else{
    data.classes.push({
      id:uid("class"),
      professorId:state.professor.id,
      createdAt:new Date().toISOString(),
      ...payload
    });
  }

  saveData(data);
  resetClassForm();
  populateClassSelects();
  renderClassList();
  renderProfessorHeroStats();
  renderOverviewMetrics();
  toast(editId ? "Turma atualizada." : "Turma cadastrada.","success");
}

function renderClassList(){
  const list = $("#classList");
  const classes = currentProfessorClasses();

  if(!classes.length){
    list.innerHTML = emptyState(
      "⌂",
      "Nenhuma turma cadastrada",
      "Cadastre a primeira turma para organizar alunos, atividades e relatórios."
    );
    return;
  }

  list.innerHTML = classes.map(item => `
    <article class="list-card">
      <div class="list-card-top">
        <div>
          <h3>${escapeHtml(item.name)}</h3>
          <p>${escapeHtml(item.grade || "Etapa não informada")} • ${escapeHtml(item.schoolYear || "—")}</p>
        </div>
        <span class="badge">${escapeHtml(item.code)}</span>
      </div>

      <div class="badge-row">
        <span class="badge">Níveis: ${escapeHtml((item.levels || []).join(", ") || "nenhum")}</span>
      </div>

      ${classObservationHasContent(item.supportObservations) ? `
        <div class="class-support-status">
          <strong>${Number(item.supportObservations?.studentCount || 0)}</strong> aluno(s) com observações pedagógicas para adaptação
        </div>
      ` : ""}

      <div class="card-actions">
        <button class="btn btn-small btn-outline" type="button" data-edit-class="${item.id}">
          EDITAR TURMA
        </button>
        <button class="btn btn-small btn-gold" type="button" data-class-observations="${item.id}">
          OBSERVAÇÕES DA TURMA
        </button>
      </div>
    </article>
  `).join("");

  $$("[data-edit-class]",list).forEach(button => {
    button.addEventListener("click",() => editClass(button.dataset.editClass));
  });

  $$("[data-class-observations]",list).forEach(button => {
    button.addEventListener("click",() => openClassObservations(button.dataset.classObservations));
  });
}

function editClass(classId){
  const item = currentProfessorClasses().find(c => c.id === classId);
  if(!item) return;

  $("#classEditId").value = item.id;
  $("#className").value = item.name || "";
  $("#classGrade").value = item.grade || "";
  $("#classYear").value = item.schoolYear || "";
  $("#classCode").value = item.code || "";
  state.classObservationDraft = normalizeClassObservationData(item.supportObservations);
  setClassObservationSummary(state.classObservationDraft);

  $$('input[name="classLevel"]').forEach(input => {
    input.checked = (item.levels || []).includes(input.value);
  });

  $("#classFormTitle").textContent = "Editar turma";
  $("#cancelClassEditBtn").classList.remove("hidden");
  setWorkspaceTab("classes");
}

function resetClassForm(){
  $("#classForm").reset();
  $("#classEditId").value = "";
  $("#classFormTitle").textContent = "Cadastrar turma";
  $("#cancelClassEditBtn").classList.add("hidden");
  $("#classYear").value = new Date().getFullYear();
  $("#classCode").value = makeRandomClassCode();
  state.classObservationDraft = emptyClassObservationData();
  setClassObservationSummary(state.classObservationDraft);
}

/* ============================================================
   BANCO DE ATIVIDADES
   ============================================================ */
function contextMatchesActivity(activity){
  if(!state.currentContext) return true;
  return activity.contextSlug === state.currentContext.slug;
}

function getActivityAssignedClasses(activityId,data,classes){
  const assignedIds = new Set(
    data.assignments
      .filter(item => item.activityId === activityId)
      .map(item => item.classId)
  );

  return classes.filter(item => assignedIds.has(item.id));
}

function renderAssignmentStatus(activityId,data,classes){
  const assigned = getActivityAssignedClasses(activityId,data,classes);

  if(!assigned.length){
    return `<div class="assignment-status assignment-status-empty">Ainda não liberada para nenhuma turma.</div>`;
  }

  return `
    <div class="assignment-status">
      <strong>Liberada para:</strong>
      <div class="assignment-class-badges">
        ${assigned.map(item => `<span>${escapeHtml(item.name)}</span>`).join("")}
      </div>
    </div>
  `;
}

function renderActivityList(){
  const list = $("#activityList");
  const data = loadData();

  const search = String($("#activitySearch")?.value || "").trim().toLowerCase();
  const level = $("#activityLevelFilter")?.value || "";
  const sort = $("#activitySort")?.value || "newest";

  let items = data.activities.filter(activity =>
    activity.professorId === state.professor.id &&
    contextMatchesActivity(activity)
  );

  if(search){
    items = items.filter(item =>
      [item.title,item.statement,item.question,item.module,item.area]
        .some(value => String(value || "").toLowerCase().includes(search))
    );
  }

  if(level){
    items = items.filter(item => item.level === level);
  }

  if(sort === "title"){
    items.sort((a,b) => String(a.title).localeCompare(String(b.title),"pt-BR"));
  }else{
    items.sort((a,b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }

  const count = $("#activityResultCount");
  if(count){
    count.textContent = `${items.length} ${items.length === 1 ? "atividade" : "atividades"}`;
  }

  if(!items.length){
    const hasFilters = Boolean(search || level);

    list.innerHTML = emptyState(
      hasFilters ? "⌕" : "＋",
      hasFilters ? "Nenhuma atividade encontrada" : "Seu banco ainda está vazio",
      hasFilters
        ? "Tente ajustar a pesquisa ou os filtros selecionados."
        : "Importe um arquivo para começar a montar seu banco de atividades.",
      hasFilters ? "" : "IMPORTAR ATIVIDADES",
      hasFilters ? "" : 'data-empty-open-upload'
    );

    $("[data-empty-open-upload]",list)?.addEventListener("click",() => {
      setWorkspaceTab("upload");
    });

    return;
  }

  const classes = currentProfessorClasses();

  list.innerHTML = items.map(item => `
    <article class="activity-card premium-activity-card">
      <div class="activity-card-top">
        <div>
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.statement)}</p>
        </div>
        <span class="badge">${escapeHtml(item.level || "Sem nível")}</span>
      </div>

      <div class="badge-row">
        <span class="badge">${escapeHtml(item.area)}</span>
        <span class="badge">${escapeHtml(item.module)}</span>
        <span class="badge">${escapeHtml(item.type || "atividade")}</span>
      </div>

      <div class="assignment-release-panel">
        <div class="assignment-release-heading">
          <div>
            <strong>Liberar atividade para</strong>
            <small>Selecione uma turma, várias turmas ou todas.</small>
          </div>
        </div>

        ${classes.length ? `
          <div class="assignment-release-controls">
            <details class="class-multiselect" data-class-picker="${item.id}">
              <summary>
                <span data-selection-summary="${item.id}">Escolha as turmas</span>
                <span class="class-picker-arrow">⌄</span>
              </summary>

              <div class="class-multiselect-menu">
                <label class="class-option class-option-all">
                  <input type="checkbox" data-assign-all="${item.id}">
                  <span>Todas as turmas</span>
                </label>

                <div class="class-option-list">
                  ${classes.map(c => `
                    <label class="class-option">
                      <input type="checkbox" value="${c.id}" data-assign-class="${item.id}">
                      <span>${escapeHtml(c.name)}</span>
                    </label>
                  `).join("")}
                </div>
              </div>
            </details>

            <button class="btn btn-primary assignment-release-button" type="button" data-assign-activity="${item.id}">
              LIBERAR ATIVIDADE
            </button>
          </div>
        ` : `
          <div class="assignment-no-classes">
            Cadastre uma turma para poder liberar esta atividade.
          </div>
        `}

        ${renderAssignmentStatus(item.id,data,classes)}
      </div>
    </article>
  `).join("");

  items.forEach(item => setupActivityClassPicker(item.id,classes,list));

  $$('[data-assign-activity]',list).forEach(button => {
    button.addEventListener('click',() => {
      const activityId = button.dataset.assignActivity;
      const selected = $$(`[data-assign-class="${activityId}"]:checked`,list)
        .map(input => input.value);

      if(!selected.length){
        return toast('Escolha pelo menos uma turma.','error');
      }

      assignActivityToClasses(activityId,selected);
    });
  });
}

function setupActivityClassPicker(activityId,classes,root){
  const allInput = $(`[data-assign-all="${activityId}"]`,root);
  const classInputs = $$(`[data-assign-class="${activityId}"]`,root);
  const summary = $(`[data-selection-summary="${activityId}"]`,root);

  if(!allInput || !summary) return;

  const updateSummary = () => {
    const selected = classInputs.filter(input => input.checked);
    const allSelected = classInputs.length > 0 && selected.length === classInputs.length;

    allInput.checked = allSelected;
    allInput.indeterminate = selected.length > 0 && !allSelected;

    if(allSelected){
      summary.textContent = 'Todas as turmas';
    }else if(selected.length === 1){
      const selectedClass = classes.find(item => item.id === selected[0].value);
      summary.textContent = selectedClass?.name || '1 turma selecionada';
    }else if(selected.length > 1){
      summary.textContent = `${selected.length} turmas selecionadas`;
    }else{
      summary.textContent = 'Escolha as turmas';
    }
  };

  allInput.addEventListener('change',() => {
    classInputs.forEach(input => {
      input.checked = allInput.checked;
    });
    updateSummary();
  });

  classInputs.forEach(input => input.addEventListener('change',updateSummary));
  updateSummary();
}

function assignActivityToClasses(activityId,classIds){
  const data = loadData();
  const uniqueClassIds = [...new Set(classIds)];
  let added = 0;

  uniqueClassIds.forEach(classId => {
    const exists = data.assignments.some(item =>
      item.activityId === activityId &&
      item.classId === classId
    );

    if(!exists){
      data.assignments.push({
        id:uid("assign"),
        activityId,
        classId,
        createdAt:new Date().toISOString()
      });
      added += 1;
    }
  });

  saveData(data);
  renderOverviewMetrics();
  renderActivityList();

  if(added === 0){
    toast('A atividade já estava liberada para as turmas selecionadas.','info');
  }else if(uniqueClassIds.length === 1){
    toast('Atividade liberada para a turma selecionada.','success');
  }else{
    toast(`Atividade liberada para ${uniqueClassIds.length} turmas.`,`success`);
  }
}

function assignActivity(activityId,classId){
  assignActivityToClasses(activityId,[classId]);
}

/* ============================================================
   UPLOAD CSV
   ============================================================ */
async function processActivityFile(fileOverride=null){
  const file = fileOverride || $("#activityFile").files?.[0];

  if(!file){
    return toast("Selecione um arquivo CSV, XLS, XLSX ou DOCX.","error");
  }

  const extension = file.name.split(".").pop().toLowerCase();

  if(!["csv","xls","xlsx","docx"].includes(extension)){
    return toast("Formato não aceito. Use CSV, XLS, XLSX ou DOCX.","error");
  }

  $("#activityFileDropTitle").textContent = file.name;
  $("#activityFileDropMeta").textContent =
    `${extension.toUpperCase()} • ${formatFileSize(file.size)} • analisando...`;

  let rows = [];

  try{
    rows = await parseActivityImportFile(file);
  }catch(error){
    $("#activityFileDropMeta").textContent =
      `${extension.toUpperCase()} • não foi possível ler o arquivo`;
    return toast(error.message || "Não foi possível ler o arquivo.","error",6500);
  }

  if(!rows.length){
    $("#activityFileDropMeta").textContent =
      `${extension.toUpperCase()} • nenhuma atividade encontrada`;
    return toast("Nenhuma atividade identificada no arquivo.","error");
  }

  const normalizedRows = rows.map(normalizeActivityRow);

  const valid = normalizedRows.filter(row => row.title && row.statement);
  const invalid = normalizedRows.filter(row => !row.title || !row.statement);

  state.pendingImport = {
    fileName:file.name,
    extension,
    total:normalizedRows.length,
    valid,
    invalid
  };

  $("#activityFileDropMeta").textContent =
    `${extension.toUpperCase()} • ${formatFileSize(file.size)} • ${valid.length} atividade(s) válida(s)`;

  renderUploadPreview();
}

function renderUploadPreview(){
  const pending = state.pendingImport;
  const preview = $("#uploadPreview");

  if(!pending){
    preview.classList.add("hidden");
    $("#uploadConfirmActions").classList.add("hidden");
    return;
  }

  preview.classList.remove("hidden");
  preview.innerHTML = `
    <div class="upload-preview-head">
      <div>
        <span class="eyebrow">ARQUIVO PRONTO</span>
        <h3>${escapeHtml(pending.fileName)}</h3>
      </div>

      <span class="review-status ${pending.invalid.length ? "review-warning" : "review-ok"}">
        ${pending.invalid.length ? "Há linhas para revisar" : "Pronto para importar"}
      </span>
    </div>

    <div class="upload-kpis">
      ${metricCard("Encontradas",String(pending.total),"linhas ou registros","blue")}
      ${metricCard("Válidas",String(pending.valid.length),"serão importadas","green")}
      ${metricCard("Ignoradas",String(pending.invalid.length),"sem título ou enunciado","gold")}
    </div>

    ${pending.valid.length ? `
      <div class="preview-sample">
        <strong>Prévia</strong>
        ${pending.valid.slice(0,6).map((row,index) => `
          <div class="preview-row">
            <span>${String(index+1).padStart(2,"0")}</span>
            <div>
              <strong>${escapeHtml(row.title)}</strong>
              <small>${escapeHtml(row.statement.slice(0,120))}${row.statement.length > 120 ? "…" : ""}</small>
            </div>
          </div>
        `).join("")}
      </div>
    ` : ""}
  `;

  $("#uploadConfirmActions").classList.toggle(
    "hidden",
    pending.valid.length === 0
  );
}

function confirmActivityImport(){
  const pending = state.pendingImport;

  if(!pending?.valid?.length){
    return toast("Selecione e analise um arquivo antes de importar.","error");
  }

  const data = loadData();
  const classId = $("#uploadAssignClass").value || null;
  let created = 0;

  pending.valid.forEach(row => {
    const activity = {
      id:uid("activity"),
      professorId:state.professor.id,
      contextSlug:state.currentContext?.slug || "geral",
      area:state.currentContext?.area || "Geral",
      module:state.currentContext?.module || state.currentContext?.title || "Atividade",
      title:row.title,
      statement:row.statement,
      question:row.question,
      answer:row.answer,
      level:row.level,
      type:row.type,
      operandA:row.operandA,
      operandB:row.operandB,
      unit:row.unit,
      createdAt:new Date().toISOString()
    };

    data.activities.push(activity);

    if(classId){
      data.assignments.push({
        id:uid("assign"),
        activityId:activity.id,
        classId,
        createdAt:new Date().toISOString()
      });
    }

    created += 1;
  });

  saveData(data);

  $("#uploadResult").innerHTML = `
    <div class="success-panel">
      <strong>Importação concluída</strong>
      <p>${created} ${created === 1 ? "atividade foi adicionada" : "atividades foram adicionadas"} ao banco.</p>
    </div>
  `;

  resetActivityImport();
  renderActivityList();
  renderOverviewMetrics();
  renderProfessorHeroStats();

  toast(`${created} atividade(s) importada(s).`,"success");
}

function resetActivityImport(){
  $("#activityFile").value = "";
  $("#uploadPreview").classList.add("hidden");
  $("#uploadConfirmActions").classList.add("hidden");
  $("#activityFileDropTitle").textContent = "Clique ou arraste o arquivo aqui";
  $("#activityFileDropMeta").textContent = "CSV • XLS • XLSX • DOCX";
  state.pendingImport = null;
}

function formatFileSize(bytes){
  const value = Number(bytes || 0);

  if(value < 1024) return `${value} B`;
  if(value < 1024*1024) return `${(value/1024).toFixed(1)} KB`;
  return `${(value/(1024*1024)).toFixed(1)} MB`;
}

async function parseActivityImportFile(file){
  const extension = file.name.split(".").pop().toLowerCase();

  if(extension === "csv"){
    return parseCsvFile(file);
  }

  if(extension === "xls" || extension === "xlsx"){
    return parseSpreadsheetFile(file);
  }

  if(extension === "docx"){
    return parseDocxFile(file);
  }

  throw new Error("Formato não suportado.");
}

async function parseCsvFile(file){
  const text = await file.text();

  if(window.XLSX){
    const workbook = XLSX.read(text,{type:"string"});
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

    return XLSX.utils.sheet_to_json(firstSheet,{
      defval:"",
      raw:false
    });
  }

  return parseDelimitedText(text);
}

async function parseSpreadsheetFile(file){
  if(!window.XLSX){
    throw new Error(
      "O leitor de planilhas não carregou. Verifique a conexão com a internet e tente novamente."
    );
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer,{type:"array"});

  if(!workbook.SheetNames.length){
    return [];
  }

  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  return XLSX.utils.sheet_to_json(sheet,{
    defval:"",
    raw:false
  });
}

async function parseDocxFile(file){
  if(!window.mammoth){
    throw new Error(
      "O leitor de DOCX não carregou. Verifique a conexão com a internet e tente novamente."
    );
  }

  const buffer = await file.arrayBuffer();
  const result = await mammoth.convertToHtml({arrayBuffer:buffer});
  const parser = new DOMParser();
  const doc = parser.parseFromString(result.value,"text/html");

  const firstTable = doc.querySelector("table");

  if(firstTable){
    const tableRows = [...firstTable.querySelectorAll("tr")].map(row =>
      [...row.querySelectorAll("th,td")].map(cell => cell.textContent.trim())
    );

    if(tableRows.length >= 2){
      const headers = tableRows[0].map(value => value.trim());

      return tableRows.slice(1)
        .filter(row => row.some(value => String(value).trim()))
        .map(row =>
          Object.fromEntries(
            headers.map((header,index) => [header,row[index] ?? ""])
          )
        );
    }
  }

  const raw = await mammoth.extractRawText({arrayBuffer:buffer});
  return parseLabeledDocxText(raw.value);
}

function parseLabeledDocxText(text){
  const allowed = [
    "titulo",
    "enunciado",
    "pergunta",
    "resposta",
    "nivel",
    "tipo",
    "unidade",
    "operando_a",
    "operando_b"
  ];

  const normalizedLines = String(text || "")
    .replace(/\r/g,"")
    .split("\n")
    .map(line => line.trim());

  const result = [];
  let current = {};

  function pushCurrent(){
    if(Object.keys(current).length){
      result.push(current);
      current = {};
    }
  }

  normalizedLines.forEach(line => {
    if(!line){
      if(current.titulo && current.enunciado){
        pushCurrent();
      }
      return;
    }

    const match = line.match(/^([^:]+)\s*:\s*(.*)$/);

    if(!match){
      return;
    }

    const key = match[1]
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g,"")
      .replace(/\s+/g,"_");

    if(!allowed.includes(key)){
      return;
    }

    if(key === "titulo" && current.titulo){
      pushCurrent();
    }

    current[key] = match[2].trim();
  });

  pushCurrent();
  return result;
}

function parseDelimitedText(text){
  const lines = String(text || "")
    .split(/\r?\n/)
    .filter(line => line.trim() !== "");

  if(!lines.length) return [];

  const separator = lines[0].includes(";") ? ";" : ",";
  const matrix = lines.map(line => splitDelimitedLine(line,separator));
  const headers = matrix.shift().map(value => value.trim());

  return matrix.map(columns =>
    Object.fromEntries(
      headers.map((header,index) => [header,(columns[index] ?? "").trim()])
    )
  );
}

function splitDelimitedLine(line,separator){
  const result = [];
  let current = "";
  let quoted = false;

  for(let i=0;i<line.length;i++){
    const char = line[i];

    if(char === '"'){
      if(quoted && line[i+1] === '"'){
        current += '"';
        i += 1;
      }else{
        quoted = !quoted;
      }
      continue;
    }

    if(char === separator && !quoted){
      result.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current);
  return result;
}

/* ============================================================
   PERFIL / SEGURANÇA
   ============================================================ */
function showProfessorProfile(){
  const data = loadData();
  const professor = data.professors.find(p => p.id === state.professor.id);
  if(!professor) return;

  state.professor = professor;

  $("#profileInfo").innerHTML = `
    <div class="profile-row">
      <small>Nome</small>
      <strong>${escapeHtml(professor.name)}</strong>
    </div>

    <div class="profile-row">
      <small>Usuário</small>
      <strong>${escapeHtml(professor.username)}</strong>
    </div>

    <div class="profile-row">
      <small>Perfil</small>
      <strong>Professor</strong>
    </div>
  `;

  $("#requireAdminKeyToggle").checked = Boolean(professor.requireAdminKey);
  setActiveTopNav("profile");
  showScreen("screenProfessorProfile");
}

async function changeMyAccessKey(event){
  event.preventDefault();

  const newKey = $("#newAccessKey").value;
  const confirmKey = $("#confirmAccessKey").value;

  if(newKey.length < 8){
    return toast("A nova chave deve ter pelo menos 8 caracteres.","error");
  }

  if(newKey !== confirmKey){
    return toast("As chaves não coincidem.","error");
  }

  const data = loadData();
  const professor = data.professors.find(p => p.id === state.professor.id);
  if(!professor) return;

  professor.accessKeyHash = await hashText(newKey);
  saveData(data);
  state.professor = professor;

  event.target.reset();
  toast("Chave pessoal alterada.","success");
}

function setAdminKeyRequired(){
  const data = loadData();
  const professor = data.professors.find(p => p.id === state.professor.id);
  if(!professor) return;

  professor.requireAdminKey = $("#requireAdminKeyToggle").checked;
  saveData(data);
  state.professor = professor;

  toast(
    professor.requireAdminKey
      ? "A chave pessoal será exigida ao abrir a área administrativa."
      : "A chave pessoal não será exigida ao abrir a área administrativa.",
    "success"
  );
}

/* ============================================================
   ALUNO
   ============================================================ */
function showStudentDashboard(){
  stopActivityTimer(true);

  const data = loadData();
  const student = data.students.find(s => s.id === state.student.id);

  if(!student){
    logout();
    return;
  }

  state.student = student;
  state.currentClass = data.classes.find(c => c.id === student.classId) || null;

  setTopbarIdentity(student.name,"Aluno");
  setActiveTopNav("student-dashboard");
  setTopbar(true,"student");

  $("#studentWelcome").textContent = `Olá, ${student.plainName}.`;
  $("#studentClassInfo").textContent = state.currentClass
    ? `${state.currentClass.name} • Código ${state.currentClass.code}`
    : "";

  const assignedIds = data.assignments
    .filter(item => item.classId === student.classId)
    .map(item => item.activityId);

  const items = data.activities.filter(item => assignedIds.includes(item.id));

  renderStudentProgressSummary(items,data);
  renderStudentCatalog(items,data);
  renderStudentActivities(items,data,state.studentContextSlug);

  showScreen("screenStudentDashboard");
}

function renderStudentProgressSummary(items,data){
  const host = $("#studentProgressSummary");
  if(!host) return;

  const submissions = data.submissions.filter(s =>
    s.studentId === state.student.id &&
    items.some(item => item.id === s.activityId)
  );

  const resolved = submissions.filter(s => s.resolved).length;
  const inProgress = submissions.filter(s => !s.resolved).length;
  const notStarted = Math.max(0,items.length - submissions.length);
  const progress = items.length ? Math.round((resolved/items.length)*100) : 0;

  host.innerHTML = `
    <div class="student-progress-card">
      <div class="progress-copy">
        <span class="eyebrow">SEU PROGRESSO</span>
        <strong>${progress}% concluído</strong>
        <small>${resolved} de ${items.length} atividades concluídas</small>
      </div>

      <div class="progress-bar" aria-label="${progress}% concluído">
        <span style="width:${progress}%"></span>
      </div>

      <div class="student-status-grid">
        <div><strong>${notStarted}</strong><span>Não iniciadas</span></div>
        <div><strong>${inProgress}</strong><span>Em andamento</span></div>
        <div><strong>${resolved}</strong><span>Concluídas</span></div>
      </div>
    </div>
  `;
}

function getStudentContextBySlug(slug){
  for(const row of STREAMING_ROWS){
    const item = row.items.find(entry => entry.slug === slug);
    if(item) return item;
  }
  return null;
}

function renderStudentCatalog(items,data){
  const container = $("#studentCatalogRows");
  if(!container) return;

  container.innerHTML = "";

  STREAMING_ROWS.forEach(row => {
    const section = document.createElement("section");
    section.className = "student-stream-row";

    section.innerHTML = `
      <div class="student-stream-row-heading">
        <h3>${escapeHtml(row.title)}</h3>
      </div>
      <div class="student-cover-grid"></div>
    `;

    const grid = $(".student-cover-grid",section);

    row.items.forEach(context => {
      const contextItems = items.filter(activity => activity.contextSlug === context.slug);
      const resolvedCount = contextItems.filter(activity => {
        const submission = data.submissions.find(s =>
          s.studentId === state.student.id &&
          s.activityId === activity.id
        );
        return submission?.resolved;
      }).length;

      const button = document.createElement("button");
      button.type = "button";
      button.className = "student-cover-item";
      button.dataset.studentContext = context.slug;

      if(state.studentContextSlug === context.slug){
        button.classList.add("active");
      }

      const activityLabel = contextItems.length === 1
        ? "1 atividade liberada"
        : `${contextItems.length} atividades liberadas`;

      button.innerHTML = `
        <span class="student-cover-image">
          <img src="${escapeHtml(context.image)}" alt="${escapeHtml(context.title)}" loading="lazy">
          <span class="student-cover-fallback hidden">${escapeHtml(context.title)}</span>

          <span class="student-cover-count ${contextItems.length ? "has-activities" : ""}">
            ${contextItems.length}
          </span>
        </span>

        <span class="student-cover-copy">
          <strong>${escapeHtml(context.title)}</strong>
          <small>${escapeHtml(context.subtitle || "")}</small>

          <span class="student-cover-meta">
            <span>${escapeHtml(activityLabel)}</span>
            ${contextItems.length ? `<span>${resolvedCount}/${contextItems.length} concluídas</span>` : ""}
          </span>
        </span>
      `;

      const img = $("img",button);
      const fallback = $(".student-cover-fallback",button);

      img.addEventListener("load",() => {
        fallback.classList.add("hidden");
      });

      img.addEventListener("error",() => {
        img.classList.add("hidden");
        fallback.classList.remove("hidden");
      });

      button.addEventListener("click",() => {
        state.studentContextSlug = context.slug;

        $$(".student-cover-item").forEach(card => {
          card.classList.toggle(
            "active",
            card.dataset.studentContext === context.slug
          );
        });

        renderStudentActivities(items,data,context.slug);

        $("#studentComponentSection")?.scrollIntoView({
          behavior:"smooth",
          block:"start"
        });
      });

      grid.appendChild(button);
    });

    container.appendChild(section);
  });
}

function renderStudentActivities(items,data,contextSlug=null){
  const container = $("#studentActivityGroups");
  const titleEl = $("#studentComponentTitle");
  const subtitleEl = $("#studentComponentSubtitle");
  const clearButton = $("#clearStudentComponentFilter");

  let visibleItems = [...items];

  if(contextSlug){
    visibleItems = visibleItems.filter(item => item.contextSlug === contextSlug);
    const context = getStudentContextBySlug(contextSlug);

    titleEl.textContent = context?.title || "Atividades";
    subtitleEl.textContent = context
      ? `Atividades liberadas em ${context.title} para sua turma.`
      : "Atividades liberadas pelo professor para sua turma.";

    clearButton.classList.remove("hidden");
  }else{
    titleEl.textContent = "Todas as atividades";
    subtitleEl.textContent = "Atividades liberadas pelo professor para sua turma.";
    clearButton.classList.toggle("hidden",items.length === 0);
  }

  if(!visibleItems.length){
    const context = contextSlug ? getStudentContextBySlug(contextSlug) : null;

    container.innerHTML = emptyState(
      contextSlug ? "○" : "✓",
      contextSlug
        ? `Nenhuma atividade liberada em ${context?.title || "esta área"}`
        : "Nenhuma atividade liberada ainda",
      contextSlug
        ? "A capa está disponível para navegação, mas o professor ainda não liberou atividades deste componente para sua turma."
        : "As áreas e componentes estão disponíveis acima. Quando o professor liberar uma atividade, ela aparecerá aqui."
    );

    return;
  }

  const grouped = new Map();

  visibleItems.forEach(item => {
    const context = getStudentContextBySlug(item.contextSlug);
    const key = context?.title || item.module || item.area || "Atividades";

    if(!grouped.has(key)) grouped.set(key,[]);
    grouped.get(key).push(item);
  });

  container.innerHTML = [...grouped.entries()].map(([groupTitle,groupItems]) => `
    <section class="student-group">
      ${contextSlug ? "" : `<h3 class="student-activity-group-title">${escapeHtml(groupTitle)}</h3>`}

      <div class="student-activity-grid">
        ${groupItems.map(item => {
          const submission = data.submissions.find(s =>
            s.studentId === state.student.id &&
            s.activityId === item.id
          );

          const status = submission?.resolved
            ? "Concluída"
            : submission
              ? "Em andamento"
              : "Não iniciada";

          const statusClass = submission?.resolved
            ? "is-complete"
            : submission
              ? "is-progress"
              : "is-new";

          return `
            <button class="student-activity-card ${statusClass}" type="button" data-student-activity="${item.id}">
              <div class="student-card-top">
                <span class="eyebrow">${escapeHtml(item.level || item.area || "")}</span>
                <span class="student-status">${status}</span>
              </div>

              <h3>${escapeHtml(item.title)}</h3>
              <p>${escapeHtml(item.statement)}</p>

              <div class="badge-row">
                <span class="badge">${escapeHtml(item.module || item.area || "Atividade")}</span>
                <span class="badge">Tentativas: ${submission?.attempts || 0}</span>
              </div>

              <span class="student-open-action">Abrir atividade →</span>
            </button>
          `;
        }).join("")}
      </div>
    </section>
  `).join("");

  $$("[data-student-activity]",container).forEach(button => {
    button.addEventListener("click",() => {
      const item = visibleItems.find(
        activity => activity.id === button.dataset.studentActivity
      );

      if(item) openStudentActivity(item);
    });
  });
}

function openStudentActivity(item){
  const data = loadData();

  let submission = data.submissions.find(s =>
    s.studentId === state.student.id &&
    s.activityId === item.id
  );

  if(!submission){
    submission = {
      id:uid("submission"),
      studentId:state.student.id,
      classId:state.student.classId,
      activityId:item.id,
      accessedAt:new Date().toISOString(),
      updatedAt:new Date().toISOString(),
      resolved:false,
      attempts:0,
      activeSeconds:0,
      scratch:"",
      finalAnswer:""
    };

    data.submissions.push(submission);
    saveData(data);
  }

  state.currentActivity = item;
  state.materialBoard = null;
  state.activeSeconds = Number(submission.activeSeconds || 0);

  $("#studentActivityMeta").textContent = [item.area,item.module,item.level].filter(Boolean).join(" • ");
  $("#studentActivityTitle").textContent = item.title;
  $("#studentActivityStatement").textContent = item.statement || "";
  $("#studentActivityQuestion").textContent = item.question || "";
  $("#studentScratch").value = submission.scratch || "";

  renderStudentAnswerArea(submission);
  renderInteractiveArea(item);

  showScreen("screenStudentActivity");
  startActivityTimer();

  setupProtectedScratchField();
  captureScratchHistorySnapshot("abertura da atividade",false);

  state.scratchSaveDebounced = debounce(saveCurrentProgress,600);

  $("#studentScratch").oninput = () => {
    state.scratchSaveDebounced?.();
    scheduleScratchHistoryCapture();
  };

  $("#studentScratch").onblur = () => {
    captureScratchHistorySnapshot("pausa na escrita",true);
    saveCurrentProgress();
  };
}

function renderStudentAnswerArea(submission){
  const area = $("#studentAnswerArea");

  area.innerHTML = `
    <div class="answer-actions">
      <label>
        Resposta final
        <input id="studentFinalAnswer" type="text" placeholder="Digite sua resposta">
      </label>

      <button id="submitStudentAnswerBtn" class="btn btn-primary" type="button">
        ENVIAR RESPOSTA
      </button>
    </div>
  `;

  $("#studentFinalAnswer").value = submission.finalAnswer || "";
  $("#submitStudentAnswerBtn").addEventListener("click",submitStudentAnswer);
}


function getCurrentSubmission(data=loadData()){
  if(!state.student || !state.currentActivity) return null;

  return data.submissions.find(s =>
    s.studentId === state.student.id &&
    s.activityId === state.currentActivity.id
  ) || null;
}

function ensureScratchHistory(submission){
  if(!submission) return [];

  if(!Array.isArray(submission.scratchHistory)){
    submission.scratchHistory = [];

    const existing = String(submission.scratch || "");
    if(existing.trim()){
      submission.scratchHistory.push({
        at:submission.updatedAt || submission.accessedAt || new Date().toISOString(),
        text:existing,
        reason:"rascunho anterior"
      });
    }
  }

  return submission.scratchHistory;
}

function captureScratchHistorySnapshot(reason="digitação",force=false){
  if(!state.student || !state.currentActivity) return;

  const field = $("#studentScratch");
  if(!field) return;

  const data = loadData();
  const submission = getCurrentSubmission(data);
  if(!submission) return;

  const history = ensureScratchHistory(submission);
  const text = field.value || "";
  const last = history.at(-1);

  if(last?.text === text) return;

  // Evita registrar um histórico vazio logo na abertura.
  if(!text.trim() && !history.length) return;

  const now = new Date();
  const lastTime = last?.at ? new Date(last.at).getTime() : 0;
  const elapsed = Date.now() - lastTime;
  const delta = Math.abs(text.length - String(last?.text || "").length);

  // Capturas automáticas: após pausas de escrita, evitando excesso de versões.
  // Capturas forçadas ocorrem ao sair do campo, enviar resposta ou sair da atividade.
  if(!force && last && elapsed < 5000 && delta < 12) return;

  history.push({
    at:now.toISOString(),
    text,
    reason
  });

  // Limite local para impedir crescimento indefinido do navegador.
  if(history.length > 150){
    submission.scratchHistory = history.slice(-150);
  }

  submission.scratch = text;
  submission.updatedAt = now.toISOString();
  saveData(data);
}

function scheduleScratchHistoryCapture(){
  if(state.scratchHistoryTimer){
    clearTimeout(state.scratchHistoryTimer);
  }

  state.scratchHistoryTimer = setTimeout(() => {
    captureScratchHistorySnapshot("digitação",false);
    state.scratchHistoryTimer = null;
  },2500);
}

function blockScratchAction(event,message="Ação bloqueada no rascunho. Digite o conteúdo manualmente."){
  event.preventDefault();
  event.stopPropagation();
  toast(message,"info");
}

function setupProtectedScratchField(){
  const field = $("#studentScratch");
  if(!field) return;

  // Evita empilhar listeners toda vez que uma nova atividade é aberta.
  if(field.dataset.protectionBound === "1") return;
  field.dataset.protectionBound = "1";

  field.addEventListener("keydown",event => {
    const key = String(event.key || "").toLowerCase();

    if((event.ctrlKey || event.metaKey) && ["c","v","x"].includes(key)){
      blockScratchAction(event);
    }
  });

  ["copy","paste","cut","contextmenu","drop","dragstart"].forEach(eventName => {
    field.addEventListener(eventName,event => {
      blockScratchAction(event);
    });
  });

  field.addEventListener("dragover",event => {
    // Bloqueia arrastar texto para dentro do campo.
    event.preventDefault();
    event.dataTransfer && (event.dataTransfer.dropEffect = "none");
  });

  field.addEventListener("beforeinput",event => {
    const blockedTypes = [
      "insertFromPaste",
      "insertFromDrop",
      "deleteByCut"
    ];

    if(blockedTypes.includes(event.inputType)){
      blockScratchAction(event);
    }
  });
}

function formatScratchReason(reason){
  const map = {
    "abertura da atividade":"Abertura",
    "digitação":"Registro durante a escrita",
    "pausa na escrita":"Pausa na escrita",
    "envio da resposta":"Envio da resposta",
    "saída da atividade":"Saída da atividade",
    "rascunho anterior":"Registro anterior"
  };

  return map[reason] || reason || "Registro";
}

function startActivityTimer(){
  stopActivityTimer(false);

  let lastTick = Date.now();
  $("#activityTimerDisplay").textContent = timerText(state.activeSeconds);

  state.timerHandle = setInterval(() => {
    const now = Date.now();

    if(!document.hidden){
      const delta = Math.max(0,Math.min(2,Math.round((now-lastTick)/1000)));
      state.activeSeconds += delta;
      $("#activityTimerDisplay").textContent = timerText(state.activeSeconds);
    }

    lastTick = now;
  },1000);

  state.heartbeatHandle = setInterval(() => {
    if(!document.hidden) saveCurrentProgress();
  },10000);
}

function stopActivityTimer(save=true){
  if(state.timerHandle){
    clearInterval(state.timerHandle);
    state.timerHandle = null;
  }

  if(state.heartbeatHandle){
    clearInterval(state.heartbeatHandle);
    state.heartbeatHandle = null;
  }

  if(save && state.currentActivity){
    captureScratchHistorySnapshot("saída da atividade",true);
    saveCurrentProgress();
  }

  if(state.scratchHistoryTimer){
    clearTimeout(state.scratchHistoryTimer);
    state.scratchHistoryTimer = null;
  }
}

function saveCurrentProgress(){
  if(!state.student || !state.currentActivity) return;

  const data = loadData();
  const submission = data.submissions.find(s =>
    s.studentId === state.student.id &&
    s.activityId === state.currentActivity.id
  );

  if(!submission) return;

  submission.activeSeconds = state.activeSeconds;
  submission.scratch = $("#studentScratch")?.value || submission.scratch || "";
  submission.finalAnswer = $("#studentFinalAnswer")?.value || submission.finalAnswer || "";
  submission.updatedAt = new Date().toISOString();

  const student = data.students.find(s => s.id === state.student.id);
  if(student) student.lastAccess = new Date().toISOString();

  saveData(data);
}

function submitStudentAnswer(){
  const data = loadData();
  const submission = data.submissions.find(s =>
    s.studentId === state.student.id &&
    s.activityId === state.currentActivity.id
  );

  if(!submission) return;

  const answer = $("#studentFinalAnswer").value.trim();
  const expected = String(state.currentActivity.answer || "").trim();

  captureScratchHistorySnapshot("envio da resposta",true);

  // Recarrega os dados para incluir a versão de rascunho recém-salva.
  const refreshedData = loadData();
  const refreshedSubmission = refreshedData.submissions.find(s =>
    s.studentId === state.student.id &&
    s.activityId === state.currentActivity.id
  );

  if(refreshedSubmission){
    Object.assign(submission,refreshedSubmission);
  }

  submission.attempts += 1;
  submission.finalAnswer = answer;
  submission.scratch = $("#studentScratch").value;
  submission.activeSeconds = state.activeSeconds;
  submission.updatedAt = new Date().toISOString();

  const feedback = $("#studentAnswerFeedback");
  feedback.classList.remove("hidden","correct","incorrect");

  if(!expected){
    submission.resolved = false;
    feedback.classList.add("correct");
    feedback.textContent = "Resposta registrada.";
  }else{
    const correct =
      answer.replace(",",".").trim().toLowerCase() ===
      expected.replace(",",".").trim().toLowerCase();

    submission.resolved = correct;

    if(correct){
      feedback.classList.add("correct");
      feedback.textContent = "Sua resposta está correta. Parabéns!";
    }else{
      feedback.classList.add("incorrect");
      feedback.textContent = "Resposta incorreta. Revise sua estratégia e tente novamente.";
    }
  }

  if(state.materialBoard){
    submission.materialProgress = {
      board:serializeMaterialBoard(state.materialBoard),
      savedAt:new Date().toISOString(),
      reason:submission.resolved ? "resposta enviada corretamente" : "resposta enviada"
    };
  }

  saveData(data);

  const assignedIds = data.assignments
    .filter(item => item.classId === state.student.classId)
    .map(item => item.activityId);

  const assignedItems = data.activities.filter(item => assignedIds.includes(item.id));
  renderStudentProgressSummary(assignedItems,data);
}

/* ============================================================
   MATERIAL DOURADO — DIVISÃO
   ============================================================ */
function parseMaterialNumberToken(token){
  const raw = String(token || "").trim();

  if(!raw) return NaN;

  // Formatos brasileiros: 2.970, 144, 12, 4,5
  const normalized = raw
    .replace(/\.(?=\d{3}(?:\D|$))/g,"")
    .replace(",",".")
    .replace(/[^\d.-]/g,"");

  const value = Number(normalized);
  return Number.isFinite(value) ? value : NaN;
}

function inferMaterialOperands(item){
  let dividend = Number(item?.operandA);
  let divisor = Number(item?.operandB);

  const explicitDividendValid = Number.isFinite(dividend) && dividend > 0;
  const explicitDivisorValid = Number.isFinite(divisor) && divisor > 0;

  if(explicitDividendValid && explicitDivisorValid){
    return {
      dividend:Math.round(dividend),
      divisor:Math.max(1,Math.round(divisor)),
      inferred:false
    };
  }

  const source = `${item?.statement || ""} ${item?.question || ""}`;
  const tokens = source.match(/\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?/g) || [];

  const values = tokens
    .map(parseMaterialNumberToken)
    .filter(value => Number.isFinite(value) && value > 0);

  if(!explicitDividendValid){
    dividend = values[0] ?? 1;
  }

  if(!explicitDivisorValid){
    const next = values.find((value,index) =>
      index > 0 && value !== dividend
    );
    divisor = next ?? values[1] ?? 1;
  }

  // O laboratório trabalha visualmente com quantidades inteiras.
  // Não bloqueia o acesso: apenas usa uma aproximação inteira quando necessário.
  dividend = Math.max(1,Math.round(dividend));
  divisor = Math.max(1,Math.round(divisor));

  return {
    dividend,
    divisor,
    inferred:true
  };
}

function renderInteractiveArea(item){
  const area = $("#interactiveArea");

  if(item.contextSlug !== "divisao"){
    area.innerHTML = "";
    return;
  }

  const {dividend,divisor,inferred} = inferMaterialOperands(item);

  area.innerHTML = `
    <div class="material-access-card">
      <div class="material-access-icon" aria-hidden="true">
        <span class="mini-hundred"></span>
        <span class="mini-ten"></span>
        <span class="mini-unit"></span>
      </div>

      <div class="material-access-copy">
        <span class="eyebrow">RECURSO DE APOIO</span>
        <h2>Resolver com Material Dourado</h2>
        <p>
          Represente <strong>${dividend}</strong>, faça as trocas necessárias
          e distribua as peças igualmente entre <strong>${divisor}</strong> grupos.
        </p>
        ${inferred ? `
          <small class="material-inference-note">
            Os valores foram identificados automaticamente a partir da atividade.
          </small>
        ` : ""}
      </div>

      <button id="openMaterialLabBtn" class="btn btn-material-open" type="button">
        ABRIR MATERIAL DOURADO
      </button>
    </div>
  `;

  $("#openMaterialLabBtn")?.addEventListener("click",openMaterialLab);
}

function openMaterialLab(){
  const item = state.currentActivity;
  if(!item) return;

  saveCurrentProgress();

  const {dividend,divisor} = inferMaterialOperands(item);

  state.materialBoard = createMaterialBoard(dividend,divisor);

  $("#materialLabTitle").textContent = item.title || "Divisão com Material Dourado";
  $("#materialLabStatement").textContent = item.statement || "";
  $("#materialLabOperation").textContent = `${dividend} ÷ ${divisor}`;
  $("#materialLabQuestion").textContent = item.question || "";

  renderMaterialLab();
  showScreen("screenMaterialLab");
}

function closeMaterialLab(){
  showScreen("screenStudentActivity");
  $("#activityTimerDisplay").textContent = timerText(state.activeSeconds);
}

function createMaterialBoard(dividend,divisor){
  return {
    dividend,
    divisor,
    confirmed:false,
    phase:1,
    selectedType:null,
    available:{M:0,C:0,D:0,U:0},
    groups:Array.from({length:divisor},() => ({M:0,C:0,D:0,U:0})),
    solved:false
  };
}

function materialCountsValue(counts){
  const values = {M:1000,C:100,D:10,U:1};

  return Object.entries(counts || {}).reduce(
    (sum,[key,count]) => sum + (values[key] || 0) * Number(count || 0),
    0
  );
}

function materialTotalValue(board){
  const poolValue = materialCountsValue(board.available);
  const groupValue = board.groups.reduce(
    (sum,group) => sum + materialCountsValue(group),
    0
  );

  return poolValue + groupValue;
}

function pieceLabel(key){
  return {
    M:"Milhar",
    C:"Centena",
    D:"Dezena",
    U:"Unidade"
  }[key];
}

function renderPieceVisuals(counts,location="pool",groupIndex=null){
  const keys = ["M","C","D","U"];
  const totalPieces = keys.reduce((sum,key) => sum + Number(counts[key] || 0),0);

  if(!totalPieces){
    return `<div class="md-empty-pieces">Nenhuma peça</div>`;
  }

  return keys.map(key => {
    const count = Number(counts[key] || 0);
    if(!count) return "";

    const visible = Math.min(count,24);
    const pieces = Array.from({length:visible},(_,index) => {
      const draggable = location === "pool" ? 'draggable="true"' : "";
      const attrs = location === "pool"
        ? `data-drag-piece="${key}"`
        : `data-return-piece="${key}" data-return-group="${groupIndex}"`;

      return `
        <button
          type="button"
          class="md-piece md-piece-${key}"
          title="${location === "pool" ? "Arraste para um grupo" : "Clique para devolver"}"
          ${draggable}
          ${attrs}
          aria-label="${pieceLabel(key)} ${index+1}"
        ></button>
      `;
    }).join("");

    const remainder = count > visible
      ? `<span class="md-more-pieces">+${count-visible}</span>`
      : "";

    return `
      <div class="md-piece-cluster">
        <div class="md-piece-cluster-label">
          <strong>${pieceLabel(key)}</strong>
          <span>${count}</span>
        </div>
        <div class="md-pieces-row">${pieces}${remainder}</div>
      </div>
    `;
  }).join("");
}

function renderMaterialLab(){
  const board = state.materialBoard;
  const root = $("#materialLabRoot");

  if(!board || !root) return;

  const representedValue = materialCountsValue(board.available);
  const quotient = board.dividend / board.divisor;
  const integerQuotient = Number.isInteger(quotient);

  root.innerHTML = `
    <div class="material-lab-steps">
      ${[
        ["1","Representar"],
        ["2","Trocar"],
        ["3","Distribuir"],
        ["4","Conferir"]
      ].map(([number,label],index) => {
        const step = index + 1;
        const status = board.solved
          ? "done"
          : step < board.phase
            ? "done"
            : step === board.phase
              ? "active"
              : "";

        return `
          <div class="material-lab-step ${status}">
            <span>${number}</span>
            <strong>${label}</strong>
          </div>
        `;
      }).join("")}
    </div>

    <section class="material-stage">
      <div class="material-stage-heading">
        <div>
          <span class="stage-number">1</span>
          <div>
            <h2>Represente o dividendo</h2>
            <p>Monte o número ${board.dividend} usando milhar, centena, dezena e unidade.</p>
          </div>
        </div>

        <div class="representation-summary ${representedValue === board.dividend ? "is-correct" : ""}">
          <span>Representado</span>
          <strong>${representedValue}</strong>
          <small>de ${board.dividend}</small>
        </div>
      </div>

      <div class="material-white-grid">
        ${[
          ["M","MILHAR","1000"],
          ["C","CENTENA","100"],
          ["D","DEZENA","10"],
          ["U","UNIDADE","1"]
        ].map(([key,label,value]) => `
          <article class="material-white-box">
            <header>
              <div>
                <strong>${label}</strong>
                <span>vale ${value}</span>
              </div>
              <span class="material-piece-count">${board.available[key]}</span>
            </header>

            <div class="material-piece-preview material-preview-${key}">
              <span></span>
            </div>

            <div class="material-count-controls">
              <button type="button" data-md-minus="${key}" aria-label="Retirar ${label.toLowerCase()}">−</button>
              <strong>${board.available[key]}</strong>
              <button type="button" data-md-plus="${key}" aria-label="Adicionar ${label.toLowerCase()}">+</button>
            </div>
          </article>
        `).join("")}
      </div>

      <div class="material-stage-actions">
        <button id="confirmMaterialRepresentationBtn" class="btn btn-primary" type="button">
          ✓ CONFIRMAR REPRESENTAÇÃO
        </button>

        <button id="resetMaterialRepresentationBtn" class="btn btn-outline" type="button">
          Refazer representação
        </button>
      </div>

      <div class="material-message ${
        representedValue === board.dividend ? "material-message-ready" : ""
      }">
        Valor representado: <strong>${representedValue}</strong>
        <span>•</span>
        Valor necessário: <strong>${board.dividend}</strong>
      </div>
    </section>

    ${board.confirmed ? `
      <section class="material-workspace-grid">
        <aside class="material-stage material-exchange-stage">
          <div class="material-stage-heading compact">
            <div>
              <span class="stage-number">2</span>
              <div>
                <h2>Trocas</h2>
                <p>Faça trocas sem alterar o valor representado.</p>
              </div>
            </div>
          </div>

          <div class="exchange-pairs">
            <div class="exchange-pair">
              <button type="button" data-md-exchange="M-C">
                <strong>1 milhar</strong><span>→</span><small>10 centenas</small>
              </button>
              <button type="button" data-md-exchange="C-M">
                <strong>10 centenas</strong><span>→</span><small>1 milhar</small>
              </button>
            </div>

            <div class="exchange-pair">
              <button type="button" data-md-exchange="C-D">
                <strong>1 centena</strong><span>→</span><small>10 dezenas</small>
              </button>
              <button type="button" data-md-exchange="D-C">
                <strong>10 dezenas</strong><span>→</span><small>1 centena</small>
              </button>
            </div>

            <div class="exchange-pair emphasized">
              <button type="button" data-md-exchange="D-U">
                <strong>1 dezena</strong><span>→</span><small>10 unidades</small>
              </button>
              <button type="button" data-md-exchange="U-D">
                <strong>10 unidades</strong><span>→</span><small>1 dezena</small>
              </button>
            </div>
          </div>

          <div class="material-pool-card">
            <div class="material-pool-heading">
              <div>
                <strong>Peças disponíveis</strong>
                <small>Arraste uma peça ou use os botões nos grupos.</small>
              </div>
              <span>${materialCountsValue(board.available)}</span>
            </div>

            <div id="materialPiecePool" class="material-pool-pieces">
              ${renderPieceVisuals(board.available,"pool")}
            </div>
          </div>
        </aside>

        <section class="material-stage material-distribution-stage">
          <div class="material-stage-heading compact">
            <div>
              <span class="stage-number">3</span>
              <div>
                <h2>Distribua entre ${board.divisor} grupos</h2>
                <p>Os grupos devem terminar com o mesmo valor.</p>
              </div>
            </div>

            <div class="divisor-chip">
              <span>DIVISOR</span>
              <strong>${board.divisor}</strong>
            </div>
          </div>

          <div class="material-groups-grid">
            ${board.groups.map((group,index) => `
              <article class="material-group-white" data-material-group="${index}">
                <header>
                  <div>
                    <strong>Grupo ${index+1}</strong>
                    <span>Valor: ${materialCountsValue(group)}</span>
                  </div>
                  <small>
                    M:${group.M} • C:${group.C} • D:${group.D} • U:${group.U}
                  </small>
                </header>

                <div class="material-group-pieces">
                  ${renderPieceVisuals(group,"group",index)}
                </div>

                <div class="material-group-actions">
                  ${["M","C","D","U"].map(key => `
                    <button
                      type="button"
                      data-md-send="${key}"
                      data-md-group="${index}"
                      ${board.available[key] <= 0 ? "disabled" : ""}
                    >
                      + ${key}
                    </button>
                  `).join("")}
                </div>
              </article>
            `).join("")}
          </div>

          <div class="material-stage-actions">
            <button id="checkMaterialDistributionBtn" class="btn btn-primary" type="button">
              ✓ CONFERIR O RESULTADO
            </button>

            <button id="collectMaterialPiecesBtn" class="btn btn-outline" type="button">
              ↺ Recolher todas as peças
            </button>

            <button id="restartMaterialLabBtn" class="btn btn-outline" type="button">
              Refazer tudo
            </button>
          </div>

          <div id="materialDistributionFeedback" class="material-message">
            ${
              board.solved
                ? `<strong>Parabéns!</strong> Cada grupo representa ${quotient}.`
                : integerQuotient
                  ? `Distribua todas as peças igualmente. Resultado esperado por grupo: <strong>?</strong>`
                  : `Esta divisão não tem quociente inteiro e não é adequada para esta versão do laboratório.`
            }
          </div>

          ${board.solved ? `
            <div class="material-solved-panel">
              <div>
                <span>RESULTADO</span>
                <strong>${board.dividend} ÷ ${board.divisor} = ${quotient}</strong>
              </div>

              <button id="useMaterialResultBtn" class="btn btn-success" type="button">
                USAR RESULTADO NO EXERCÍCIO
              </button>
            </div>
          ` : ""}
        </section>
      </section>
    ` : ""}
  `;

  bindMaterialLabEvents();
}

function bindMaterialLabEvents(){
  const board = state.materialBoard;
  if(!board) return;

  $$("[data-md-plus]").forEach(button => {
    button.addEventListener("click",() => {
      const key = button.dataset.mdPlus;
      board.available[key] += 1;
      board.confirmed = false;
      board.phase = 1;
      board.solved = false;
      renderMaterialLab();
    });
  });

  $$("[data-md-minus]").forEach(button => {
    button.addEventListener("click",() => {
      const key = button.dataset.mdMinus;
      board.available[key] = Math.max(0,board.available[key]-1);
      board.confirmed = false;
      board.phase = 1;
      board.solved = false;
      renderMaterialLab();
    });
  });

  $("#confirmMaterialRepresentationBtn")?.addEventListener("click",() => {
    const value = materialCountsValue(board.available);

    if(value !== board.dividend){
      return toast(
        `A representação vale ${value}. Monte exatamente ${board.dividend}.`,
        "error"
      );
    }

    board.confirmed = true;
    board.phase = 2;
    renderMaterialLab();
    toast("Representação correta. Agora faça as trocas e distribua as peças.","success");
  });

  $("#resetMaterialRepresentationBtn")?.addEventListener("click",() => {
    state.materialBoard = createMaterialBoard(board.dividend,board.divisor);
    renderMaterialLab();
  });

  $$("[data-md-exchange]").forEach(button => {
    button.addEventListener("click",() => {
      applyMaterialExchange(button.dataset.mdExchange);
    });
  });

  $$("[data-md-send]").forEach(button => {
    button.addEventListener("click",() => {
      moveMaterialPieceToGroup(
        button.dataset.mdSend,
        Number(button.dataset.mdGroup)
      );
    });
  });

  $$("[data-return-piece]").forEach(button => {
    button.addEventListener("click",() => {
      returnMaterialPieceToPool(
        button.dataset.returnPiece,
        Number(button.dataset.returnGroup)
      );
    });
  });

  $$("[data-drag-piece]").forEach(piece => {
    piece.addEventListener("dragstart",event => {
      event.dataTransfer.setData("text/material-piece",piece.dataset.dragPiece);
      event.dataTransfer.effectAllowed = "move";
    });
  });

  $$("[data-material-group]").forEach(group => {
    group.addEventListener("dragover",event => {
      event.preventDefault();
      group.classList.add("is-dragover");
    });

    group.addEventListener("dragleave",() => {
      group.classList.remove("is-dragover");
    });

    group.addEventListener("drop",event => {
      event.preventDefault();
      group.classList.remove("is-dragover");

      const key = event.dataTransfer.getData("text/material-piece");
      const index = Number(group.dataset.materialGroup);

      if(key){
        moveMaterialPieceToGroup(key,index);
      }
    });
  });

  $("#collectMaterialPiecesBtn")?.addEventListener("click",() => {
    board.groups.forEach(group => {
      ["M","C","D","U"].forEach(key => {
        board.available[key] += group[key];
        group[key] = 0;
      });
    });

    board.phase = 2;
    board.solved = false;
    renderMaterialLab();
  });

  $("#restartMaterialLabBtn")?.addEventListener("click",() => {
    state.materialBoard = createMaterialBoard(board.dividend,board.divisor);
    renderMaterialLab();
  });

  $("#checkMaterialDistributionBtn")?.addEventListener("click",checkMaterialDistribution);

  $("#useMaterialResultBtn")?.addEventListener("click",() => {
    const quotient = board.dividend / board.divisor;

    closeMaterialLab();

    const answerInput = $("#studentFinalAnswer");
    if(answerInput){
      answerInput.value = String(quotient);
      answerInput.focus();
    }

    toast("Resultado transferido para a resposta final. Revise e envie.","success");
  });
}

function applyMaterialExchange(action){
  const board = state.materialBoard;
  if(!board) return;

  const pool = board.available;
  let valid = true;

  if(action === "M-C" && pool.M >= 1){
    pool.M -= 1;
    pool.C += 10;
  }else if(action === "C-M" && pool.C >= 10){
    pool.C -= 10;
    pool.M += 1;
  }else if(action === "C-D" && pool.C >= 1){
    pool.C -= 1;
    pool.D += 10;
  }else if(action === "D-C" && pool.D >= 10){
    pool.D -= 10;
    pool.C += 1;
  }else if(action === "D-U" && pool.D >= 1){
    pool.D -= 1;
    pool.U += 10;
  }else if(action === "U-D" && pool.U >= 10){
    pool.U -= 10;
    pool.D += 1;
  }else{
    valid = false;
  }

  if(!valid){
    return toast("Não há peças suficientes para realizar essa troca.","error");
  }

  board.phase = Math.max(board.phase,2);
  board.solved = false;
  renderMaterialLab();
}

function moveMaterialPieceToGroup(key,index){
  const board = state.materialBoard;
  if(!board || !board.confirmed) return;
  if(!["M","C","D","U"].includes(key)) return;
  if(!board.groups[index]) return;

  if(board.available[key] <= 0){
    return toast(`Não há ${pieceLabel(key).toLowerCase()} disponível.`,"error");
  }

  board.available[key] -= 1;
  board.groups[index][key] += 1;
  board.phase = Math.max(board.phase,3);
  board.solved = false;
  renderMaterialLab();
}

function returnMaterialPieceToPool(key,index){
  const board = state.materialBoard;
  if(!board || !board.groups[index]) return;
  if(board.groups[index][key] <= 0) return;

  board.groups[index][key] -= 1;
  board.available[key] += 1;
  board.solved = false;
  renderMaterialLab();
}

function checkMaterialDistribution(){
  const board = state.materialBoard;
  if(!board) return;

  const quotient = board.dividend / board.divisor;

  if(!Number.isInteger(quotient)){
    return toast(
      "Esta versão do Material Dourado trabalha com quociente inteiro.",
      "error"
    );
  }

  const poolValue = materialCountsValue(board.available);
  const values = board.groups.map(materialCountsValue);
  const allEqual = values.every(value => value === quotient);
  const correctTotal = materialTotalValue(board) === board.dividend;

  if(poolValue === 0 && allEqual && correctTotal){
    board.phase = 4;
    board.solved = true;
    renderMaterialLab();
    toast("Distribuição correta. Parabéns!","success");
    return;
  }

  const feedback = $("#materialDistributionFeedback");

  if(feedback){
    if(poolValue > 0){
      feedback.innerHTML =
        `Ainda existem peças disponíveis fora dos grupos. Valor restante: <strong>${poolValue}</strong>.`;
    }else{
      feedback.innerHTML =
        "Os grupos ainda não têm o mesmo valor. Revise a distribuição ou faça novas trocas.";
    }
  }

  toast("A distribuição ainda precisa ser ajustada.","error");
}

/* ============================================================
   RELATÓRIOS
   ============================================================ */
function prepareReports(){
  populateClassSelects();

  const select = $("#reportClassSelect");

  if(!select.value){
    const classes = currentProfessorClasses();
    if(classes.length) select.value = classes[0].id;
  }

  renderReport();
}

function buildReportRows(){
  const classId = $("#reportClassSelect").value;
  const data = loadData();
  const students = data.students.filter(student => student.classId === classId);

  state.reportRows = students.map(student => {
    const submissions = data.submissions.filter(s =>
      s.studentId === student.id &&
      s.classId === classId
    );

    return {
      student,
      roster:student.roster,
      rosterText:student.rosterText,
      situation:student.status || "Ativo",
      plainName:student.plainName,
      firstAccess:student.firstAccess || submissions.map(s => s.accessedAt).filter(Boolean).sort()[0] || null,
      lastAccess:student.lastAccess || submissions.map(s => s.updatedAt).filter(Boolean).sort().at(-1) || null,
      duration:submissions.reduce((sum,s) => sum + Number(s.activeSeconds || 0),0),
      accessed:submissions.length,
      resolved:submissions.filter(s => s.resolved).length,
      submissions
    };
  });
}

function sortedReportRows(){
  buildReportRows();

  const rows = [...state.reportRows];
  const sort = $("#reportSort").value;

  if(sort === "recent"){
    rows.sort((a,b) => new Date(b.lastAccess || 0) - new Date(a.lastAccess || 0));
  }else if(sort === "oldest"){
    rows.sort((a,b) =>
      new Date(a.firstAccess || "9999-12-31") -
      new Date(b.firstAccess || "9999-12-31")
    );
  }else if(sort === "duration"){
    rows.sort((a,b) => b.duration - a.duration || a.roster - b.roster);
  }else{
    rows.sort((a,b) => a.roster - b.roster);
  }

  return rows;
}

function renderReport(){
  const classId = $("#reportClassSelect").value;
  const wrap = $("#reportTableWrap");

  if(!classId){
    $("#reportMetrics").innerHTML = "";
    wrap.innerHTML = emptyState(
      "◎",
      "Selecione uma turma",
      "Escolha uma turma acima para visualizar participação, tempo e conclusões."
    );
    return;
  }

  const rows = sortedReportRows();

  const studentsCount = rows.length;
  const accessedCount = rows.filter(row => row.accessed > 0).length;
  const completedStudents = rows.filter(row => row.resolved > 0).length;
  const averageSeconds = studentsCount
    ? Math.round(rows.reduce((sum,row) => sum + row.duration,0) / studentsCount)
    : 0;

  $("#reportMetrics").innerHTML = [
    metricCard("Alunos",String(studentsCount),"cadastrados","blue"),
    metricCard("Acessaram",String(accessedCount),"com participação registrada","green"),
    metricCard("Concluíram",String(completedStudents),"ao menos uma atividade","gold"),
    metricCard("Tempo médio",formatDuration(averageSeconds),"por aluno","violet")
  ].join("");

  if(!rows.length){
    wrap.innerHTML = emptyState(
      "○",
      "Nenhum aluno cadastrado",
      "Cadastre alunos nesta turma para começar a acompanhar a participação."
    );
    return;
  }

  wrap.innerHTML = `
    <table class="report-table">
      <thead>
        <tr>
          <th>Nº</th>
          <th>Situação</th>
          <th>Aluno</th>
          <th>Primeiro acesso</th>
          <th>Último acesso</th>
          <th>Tempo nos exercícios</th>
          <th>Acessadas</th>
          <th>Resolvidas</th>
          <th></th>
        </tr>
      </thead>

      <tbody>
        ${rows.map(row => `
          <tr>
            <td class="roster-cell">${escapeHtml(row.rosterText)}</td>
            <td>
              <select class="student-situation-select"
                      data-student-situation="${row.student.id}"
                      aria-label="Situação de ${escapeHtml(row.plainName)}">
                ${["Ativo","Remanejando","Desistente"].map(option => `
                  <option value="${option}" ${row.situation === option ? "selected" : ""}>${option}</option>
                `).join("")}
              </select>
            </td>
            <td><strong>${escapeHtml(row.plainName)}</strong></td>
            <td>${escapeHtml(formatDateTime(row.firstAccess))}</td>
            <td>${escapeHtml(formatDateTime(row.lastAccess))}</td>
            <td>${escapeHtml(formatDuration(row.duration))}</td>
            <td>${row.accessed}</td>
            <td><span class="${row.resolved ? "status-ok" : "status-warn"}">${row.resolved}</span></td>
            <td>
              <button class="btn btn-small btn-outline" type="button" data-student-detail="${row.student.id}">
                DETALHES
              </button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;

  $$("[data-student-situation]",wrap).forEach(select => {
    select.addEventListener("change",() => {
      updateStudentSituation(select.dataset.studentSituation,select.value);
    });
  });

  $$("[data-student-detail]",wrap).forEach(button => {
    button.addEventListener("click",() => openStudentDetails(button.dataset.studentDetail));
  });
}


function updateStudentSituation(studentId,status){
  const allowed = ["Ativo","Remanejando","Desistente"];
  if(!allowed.includes(status)) return;

  const data = loadData();
  const student = data.students.find(item => item.id === studentId);
  if(!student) return;

  student.status = status;
  saveData(data);
  toast(`Situação atualizada para ${status}.`,"success");
  buildReportRows();
}

function openStudentDetails(studentId){
  buildReportRows();

  const row = state.reportRows.find(item => item.student.id === studentId);
  if(!row) return;

  const data = loadData();

  $("#studentDetailsTitle").textContent = `${row.rosterText}. ${row.plainName}`;

  $("#studentDetailsBody").innerHTML = row.submissions.length
    ? row.submissions.map(submission => {
        const activity = data.activities.find(a => a.id === submission.activityId);

        const history = Array.isArray(submission.scratchHistory)
          ? submission.scratchHistory
          : (submission.scratch ? [{
              at:submission.updatedAt || submission.accessedAt,
              text:submission.scratch,
              reason:"rascunho anterior"
            }] : []);

        return `
          <article class="detail-activity">
            <h4>${escapeHtml(activity?.title || "Atividade")}</h4>
            <p><strong>Acesso:</strong> ${escapeHtml(formatDateTime(submission.accessedAt))}</p>
            <p><strong>Tempo ativo:</strong> ${escapeHtml(formatDuration(submission.activeSeconds))}</p>
            <p><strong>Tentativas:</strong> ${submission.attempts || 0} • <strong>Status:</strong> ${submission.resolved ? "Resolvida" : "Em andamento"}</p>

            <div class="scratch-current-box">
              <span>RASCUNHO ATUAL</span>
              <p>${submission.scratch ? escapeHtml(submission.scratch) : "Nenhum rascunho registrado."}</p>
            </div>

            <details class="scratch-history-details">
              <summary>HISTÓRICO DO RASCUNHO (${history.length})</summary>

              <div class="scratch-history-list">
                ${history.length ? history.map((snapshot,index) => `
                  <article class="scratch-history-item">
                    <div class="scratch-history-head">
                      <strong>Versão ${index + 1}</strong>
                      <span>${escapeHtml(formatDateTime(snapshot.at))}</span>
                    </div>
                    <small>${escapeHtml(formatScratchReason(snapshot.reason))}</small>
                    <pre>${escapeHtml(snapshot.text || "")}</pre>
                  </article>
                `).join("") : `
                  <p class="scratch-history-empty">Nenhuma versão do rascunho registrada.</p>
                `}
              </div>
            </details>
          </article>
        `;
      }).join("")
    : "<p>Nenhuma atividade acessada.</p>";

  $("#studentDetailsModal").classList.remove("hidden");
}

function safeSheetName(name){
  return String(name || "Relatorio")
    .replace(/[\\/?*\[\]:]/g," ")
    .trim()
    .slice(0,31) || "Relatorio";
}

function downloadReportXlsx(){
  const classId = $("#reportClassSelect").value;
  const classItem = currentProfessorClasses().find(c => c.id === classId);

  if(!classItem) return toast("Selecione uma turma.","error");

  if(typeof XLSX === "undefined"){
    return toast(
      "Não foi possível carregar o gerador de planilhas. Verifique a conexão e tente novamente.",
      "error"
    );
  }

  const rows = sortedReportRows();
  const data = loadData();

  const participationRows = [
    [
      "Nº",
      "Situação",
      "Aluno",
      "Primeiro acesso",
      "Último acesso",
      "Tempo nos exercícios",
      "Tempo total (segundos)",
      "Atividades acessadas",
      "Atividades resolvidas"
    ],
    ...rows.map(row => [
      row.rosterText,
      row.situation || "Ativo",
      row.plainName,
      formatDateTime(row.firstAccess),
      formatDateTime(row.lastAccess),
      formatDuration(row.duration),
      row.duration,
      row.accessed,
      row.resolved
    ])
  ];

  const activityRows = [[
    "Nº",
    "Situação",
    "Aluno",
    "Atividade",
    "Acesso",
    "Última atualização",
    "Tempo ativo",
    "Tentativas",
    "Status",
    "Resposta final",
    "Rascunho atual",
    "Versões do rascunho"
  ]];

  const historyRows = [[
    "Nº",
    "Aluno",
    "Atividade",
    "Versão",
    "Data/hora",
    "Momento",
    "Conteúdo do rascunho"
  ]];

  rows.forEach(row => {
    row.submissions.forEach(submission => {
      const activity = data.activities.find(item => item.id === submission.activityId);
      const history = Array.isArray(submission.scratchHistory)
        ? submission.scratchHistory
        : (submission.scratch ? [{
            at:submission.updatedAt || submission.accessedAt,
            text:submission.scratch,
            reason:"rascunho anterior"
          }] : []);

      activityRows.push([
        row.rosterText,
        row.situation || "Ativo",
        row.plainName,
        activity?.title || "Atividade",
        formatDateTime(submission.accessedAt),
        formatDateTime(submission.updatedAt),
        formatDuration(submission.activeSeconds),
        Number(submission.attempts || 0),
        submission.resolved ? "Resolvida" : "Em andamento",
        submission.finalAnswer || "",
        submission.scratch || "",
        history.length
      ]);

      history.forEach((snapshot,index) => {
        historyRows.push([
          row.rosterText,
          row.plainName,
          activity?.title || "Atividade",
          index + 1,
          formatDateTime(snapshot.at),
          formatScratchReason(snapshot.reason),
          snapshot.text || ""
        ]);
      });
    });
  });

  const workbook = XLSX.utils.book_new();

  const participationSheet = XLSX.utils.aoa_to_sheet(participationRows);
  const activitySheet = XLSX.utils.aoa_to_sheet(activityRows);
  const historySheet = XLSX.utils.aoa_to_sheet(historyRows);

  participationSheet["!cols"] = [
    {wch:8},{wch:16},{wch:30},{wch:20},{wch:20},
    {wch:22},{wch:20},{wch:20},{wch:20}
  ];

  activitySheet["!cols"] = [
    {wch:8},{wch:16},{wch:28},{wch:34},{wch:20},{wch:20},
    {wch:18},{wch:12},{wch:16},{wch:24},{wch:45},{wch:20}
  ];

  historySheet["!cols"] = [
    {wch:8},{wch:28},{wch:34},{wch:10},{wch:20},{wch:24},{wch:70}
  ];

  XLSX.utils.book_append_sheet(workbook,participationSheet,"Participação");
  XLSX.utils.book_append_sheet(workbook,activitySheet,"Atividades");
  XLSX.utils.book_append_sheet(workbook,historySheet,"Histórico Rascunho");

  const filename = `Relatorio_Participacao_${normalizeClassCode(classItem.name)}_${classItem.year || new Date().getFullYear()}.xlsx`;

  XLSX.writeFile(workbook,filename);
  toast("Planilha de participação gerada com sucesso.","success");
}

/* ============================================================
   NAVEGAÇÃO
   ============================================================ */
function openAuthTab(role,tab){
  if(role === "professor"){
    $$("[data-prof-tab]").forEach(button =>
      button.classList.toggle("active",button.dataset.profTab === tab)
    );

    $("#professorLoginForm").classList.toggle("hidden",tab !== "login");
    $("#professorRegisterForm").classList.toggle("hidden",tab !== "register");
    return;
  }

  $$("[data-student-tab]").forEach(button =>
    button.classList.toggle("active",button.dataset.studentTab === tab)
  );

  $("#studentLoginForm").classList.toggle("hidden",tab !== "login");
  $("#studentRegisterForm").classList.toggle("hidden",tab !== "register");
}

function openProfessorGlobalWorkspace(tab){
  const config = {
    classes:{
      title:"Minhas Turmas",
      subtitle:"Cadastre, edite e organize todas as turmas do professor."
    },
    activities:{
      title:"Atividades",
      subtitle:"Consulte o banco completo de atividades e libere conteúdos para suas turmas."
    },
    reports:{
      title:"Relatórios",
      subtitle:"Acompanhe participação, acessos, conclusões e tempo registrado por turma."
    }
  };

  const selected = config[tab];
  if(!selected) return;

  // O menu superior é global. Por isso ele não depende de uma capa/área selecionada.
  state.currentContext = null;

  $("#workspaceTitle").textContent = selected.title;
  $("#workspaceSubtitle").textContent = selected.subtitle;

  const summary = $("#activityContextSummary");
  if(summary){
    summary.innerHTML = `
      <strong>Banco geral do professor</strong>
      <span>Para importar diretamente em uma área específica, abra primeiro a respectiva capa na tela Início.</span>
    `;
  }

  populateClassSelects();
  renderClassList();
  renderActivityList();

  showScreen("screenWorkspace");
  setWorkspaceTab(tab);
}

function bindEvents(){
  $("#openProfessorAccessBtn").addEventListener("click",() => showScreen("screenProfessorAuth"));
  $("#openStudentAccessBtn").addEventListener("click",() => showScreen("screenStudentAuth"));

  $$("[data-back-landing]").forEach(button => {
    button.addEventListener("click",() => showScreen("screenLanding"));
  });

  $$("[data-prof-tab]").forEach(button => {
    button.addEventListener("click",() => openAuthTab("professor",button.dataset.profTab));
  });

  $$("[data-student-tab]").forEach(button => {
    button.addEventListener("click",() => openAuthTab("student",button.dataset.studentTab));
  });

  $("#professorLoginForm").addEventListener("submit",professorLogin);
  $("#professorRegisterForm").addEventListener("submit",professorRegister);
  $("#studentLoginForm").addEventListener("submit",studentLogin);
  $("#studentRegisterForm").addEventListener("submit",studentRegister);

  $("#logoutBtn").addEventListener("click",logout);
  $("#adminGateForm").addEventListener("submit",submitAdminGate);
  $("#adminGateLogoutBtn").addEventListener("click",logout);

  $("#goHomeBtn").addEventListener("click",() => {
    if(state.role === "professor") showProfessorHome();
    if(state.role === "student") showStudentDashboard();
  });

  $$("[data-nav]").forEach(button => {
    button.addEventListener("click",() => {
      const nav = button.dataset.nav;

      if(nav === "home"){
        showProfessorHome();
        return;
      }

      if(nav === "profile"){
        showProfessorProfile();
        return;
      }

      if(nav === "classes" || nav === "activities" || nav === "reports"){
        openProfessorGlobalWorkspace(nav);
      }
    });
  });

  $$("[data-student-nav]").forEach(button => {
    button.addEventListener("click",showStudentDashboard);
  });

  $("#workspaceBackBtn").addEventListener("click",showProfessorHome);

  $$(".workspace-tab").forEach(button => {
    button.addEventListener("click",() => setWorkspaceTab(button.dataset.workTab));
  });

  $$("[data-open-work]").forEach(button => {
    button.addEventListener("click",() => setWorkspaceTab(button.dataset.openWork));
  });

  $("#classForm").addEventListener("submit",saveClass);

  $("#generateClassCodeBtn").addEventListener("click",() => {
    $("#classCode").value = makeRandomClassCode();
  });

  $("#cancelClassEditBtn").addEventListener("click",resetClassForm);
  $("#openClassObservationsBtn")?.addEventListener("click",() => openClassObservations());
  $("#closeClassObservationsBtn").addEventListener("click",closeClassObservations);
  $("#saveClassObservationsBtn").addEventListener("click",saveClassObservations);
  $("#clearClassObservationsBtn").addEventListener("click",clearClassObservationsFields);

  $("#activityFile").addEventListener("change",event => {
    const file = event.target.files?.[0];
    if(file) processActivityFile(file);
  });

  $("#processActivityFileBtn").addEventListener("click",() => processActivityFile());
  $("#confirmActivityImportBtn").addEventListener("click",confirmActivityImport);
  $("#deleteActivityImportBtn").addEventListener("click",() => {
    resetActivityImport();
    $("#uploadResult").innerHTML = "";
    toast("Importação excluída. Nenhuma atividade foi adicionada.","info");
  });

  const fileDrop = $("#activityFileDrop");

  ["dragenter","dragover"].forEach(eventName => {
    fileDrop.addEventListener(eventName,event => {
      event.preventDefault();
      fileDrop.classList.add("is-dragover");
    });
  });

  ["dragleave","drop"].forEach(eventName => {
    fileDrop.addEventListener(eventName,event => {
      event.preventDefault();
      fileDrop.classList.remove("is-dragover");
    });
  });

  fileDrop.addEventListener("drop",event => {
    const file = event.dataTransfer?.files?.[0];

    if(file){
      processActivityFile(file);
    }
  });

  $("#activitySearch").addEventListener("input",debounce(renderActivityList,180));
  $("#activityLevelFilter").addEventListener("change",renderActivityList);
  $("#activitySort").addEventListener("change",renderActivityList);

  $("#reportClassSelect").addEventListener("change",renderReport);
  $("#reportSort").addEventListener("change",renderReport);
  $("#downloadReportBtn").addEventListener("click",downloadReportXlsx);

  $("#profileBackBtn").addEventListener("click",showProfessorHome);
  $("#changeKeyForm").addEventListener("submit",changeMyAccessKey);
  $("#requireAdminKeyToggle").addEventListener("change",setAdminKeyRequired);

  $("#backToStudentDashboardBtn").addEventListener("click",showStudentDashboard);
  $("#backFromMaterialBtn").addEventListener("click",closeMaterialLab);

  $("#clearStudentComponentFilter").addEventListener("click",() => {
    state.studentContextSlug = null;

    $$(".student-cover-item").forEach(card => {
      card.classList.remove("active");
    });

    const data = loadData();

    const assignedIds = data.assignments
      .filter(item => item.classId === state.student.classId)
      .map(item => item.activityId);

    const items = data.activities.filter(item => assignedIds.includes(item.id));

    renderStudentActivities(items,data,null);
  });

  $("#classObservationsModal").addEventListener("click",event => {
    if(event.target.id === "classObservationsModal") closeClassObservations();
  });

  $("#closeStudentDetailsBtn").addEventListener("click",() => {
    $("#studentDetailsModal").classList.add("hidden");
  });

  window.addEventListener("beforeunload",() => {
    if(state.currentActivity) saveCurrentProgress();
  });
}

/* ============================================================
   INICIALIZAÇÃO
   ============================================================ */
async function init(){
  bindEvents();
  setupPasswordToggles();

  $("#classYear").value = new Date().getFullYear();
  $("#classCode").value = makeRandomClassCode();
  state.classObservationDraft = emptyClassObservationData();
  setClassObservationSummary(state.classObservationDraft);

  await restoreSession();
}

document.addEventListener("DOMContentLoaded",init);

/* ============================================================
   ATUALIZAÇÃO PEDAGÓGICA — MATERIAL DOURADO
   ============================================================ */
function createMaterialBoard(dividend,divisor){
  return {
    dividend,
    divisor,
    confirmed:false,
    phase:1,
    available:{M:0,C:0,D:0,U:0},
    groups:Array.from({length:divisor},() => ({M:0,C:0,D:0,U:0})),
    solved:false,
    batchQuantity:{M:1,C:1,D:1,U:1}
  };
}

function materialGroupLayout(groupCount){
  if(groupCount <= 4){
    return {rows:1,columns:groupCount};
  }
  if(groupCount < 12){
    return {rows:2,columns:Math.ceil(groupCount / 2)};
  }
  return {rows:3,columns:Math.ceil(groupCount / 3)};
}

function ensureMaterialContextMenu(){
  let menu = document.getElementById("materialContextMenu");

  if(!menu){
    menu = document.createElement("div");
    menu.id = "materialContextMenu";
    menu.className = "material-context-menu hidden";
    document.body.appendChild(menu);

    document.addEventListener("click",event => {
      if(!menu.contains(event.target)){
        menu.classList.add("hidden");
      }
    });

    window.addEventListener("resize",() => menu.classList.add("hidden"));
    window.addEventListener("scroll",() => menu.classList.add("hidden"),true);
  }

  return menu;
}

function renderPieceVisuals(counts,location="pool",groupIndex=null){
  const board = state.materialBoard;
  const keys = ["M","C","D","U"];
  const totalPieces = keys.reduce((sum,key) => sum + Number(counts[key] || 0),0);

  if(!totalPieces){
    return `<div class="md-empty-pieces">Nenhuma peça</div>`;
  }

  return keys.map(key => {
    const count = Number(counts[key] || 0);
    if(!count) return "";

    const visible = Math.min(count,24);
    const pieces = Array.from({length:visible},(_,index) => {
      const draggable = location === "pool" ? 'draggable="true"' : "";
      const attrs = location === "pool"
        ? `data-drag-piece="${key}" data-piece-context="${key}"`
        : `data-return-piece="${key}" data-return-group="${groupIndex}"`;

      return `
        <button
          type="button"
          class="md-piece md-piece-${key}"
          title="${location === "pool" ? "Arraste para um grupo ou clique com o botão direito para enviar" : "Clique para devolver"}"
          ${draggable}
          ${attrs}
          aria-label="${pieceLabel(key)} ${index+1}"
        ></button>
      `;
    }).join("");

    const remainder = count > visible
      ? `<span class="md-more-pieces">+${count-visible}</span>`
      : "";

    const batchQty = location === "pool"
      ? Math.max(1,Math.min((board?.batchQuantity?.[key] || 1),count))
      : 1;

    const controls = location === "pool"
      ? `
        <div class="md-batch-controls">
          <div class="batch-label">Quantidade para envio rápido com botão direito</div>
          <button type="button" data-md-batch-minus="${key}" aria-label="Diminuir quantidade">−</button>
          <strong>${batchQty}</strong>
          <button type="button" data-md-batch-plus="${key}" aria-label="Aumentar quantidade">+</button>
        </div>
      `
      : "";

    return `
      <div class="md-piece-cluster ${location === "pool" ? "md-piece-cluster-pool" : ""}" ${location === "pool" ? `data-md-pool-cluster="${key}"` : ""}>
        <div class="md-piece-cluster-label">
          <strong>${pieceLabel(key)}</strong>
          <span>${count}</span>
        </div>
        <div class="md-pieces-row">${pieces}${remainder}</div>
        ${controls}
      </div>
    `;
  }).join("");
}

function renderMaterialLab(){
  const board = state.materialBoard;
  const root = $("#materialLabRoot");
  if(!board || !root) return;

  const quotient = board.dividend / board.divisor;
  const integerQuotient = Number.isInteger(quotient);
  const layout = materialGroupLayout(board.groups.length);

  root.innerHTML = `
    <div class="material-lab-steps">
      ${[["1","Representar"],["2","Trocar"],["3","Distribuir"],["4","Conferir"]].map(([number,label],index) => {
        const step = index + 1;
        const status = board.solved ? "done" : step < board.phase ? "done" : step === board.phase ? "active" : "";
        return `
          <div class="material-lab-step ${status}">
            <span>${number}</span>
            <strong>${label}</strong>
          </div>
        `;
      }).join("")}
    </div>

    <section class="material-stage">
      <div class="material-stage-heading">
        <div>
          <span class="stage-number">1</span>
          <div>
            <h2>Represente o dividendo</h2>
            <p>Monte o número ${board.dividend} usando milhar, centena, dezena e unidade.</p>
          </div>
        </div>
      </div>

      <div class="material-white-grid">
        ${[["M","MILHAR","1000"],["C","CENTENA","100"],["D","DEZENA","10"],["U","UNIDADE","1"]].map(([key,label,value]) => `
          <article class="material-white-box">
            <header>
              <div>
                <strong>${label}</strong>
                <span>vale ${value}</span>
              </div>
              <span class="material-piece-count">${board.available[key]}</span>
            </header>

            <div class="material-piece-preview material-preview-${key}">
              <span></span>
            </div>

            <div class="material-count-controls">
              <button type="button" data-md-minus="${key}" aria-label="Retirar ${label.toLowerCase()}">−</button>
              <strong>${board.available[key]}</strong>
              <button type="button" data-md-plus="${key}" aria-label="Adicionar ${label.toLowerCase()}">+</button>
            </div>
          </article>
        `).join("")}
      </div>

      <div class="material-stage-actions">
        <button id="confirmMaterialRepresentationBtn" class="btn btn-primary" type="button">✓ CONFIRMAR REPRESENTAÇÃO ?</button>
        <button id="resetMaterialRepresentationBtn" class="btn btn-outline" type="button">Refazer representação</button>
      </div>
    </section>

    ${board.confirmed ? `
      <section class="material-workspace-grid">
        <aside class="material-stage material-exchange-stage">
          <div class="material-stage-heading compact">
            <div>
              <span class="stage-number">2</span>
              <div>
                <h2>Trocas</h2>
                <p>Faça trocas sem alterar o valor representado.</p>
              </div>
            </div>
          </div>

          <div class="exchange-lines">
            <button type="button" class="exchange-line" data-md-exchange="M-C">
              <strong>1 milhar → 10 centenas</strong>
              <small>Transforme uma peça de milhar em centenas.</small>
            </button>
            <button type="button" class="exchange-line" data-md-exchange="C-D">
              <strong>1 centena → 10 dezenas</strong>
              <small>Transforme uma peça de centena em dezenas.</small>
            </button>
            <button type="button" class="exchange-line" data-md-exchange="D-U">
              <strong>1 dezena → 10 unidades</strong>
              <small>Transforme uma peça de dezena em unidades.</small>
            </button>
            <button type="button" class="exchange-line" data-md-exchange="U-D">
              <strong>10 unidades → 1 dezena</strong>
              <small>Reagrupe dez unidades em uma dezena.</small>
            </button>
          </div>

          <div class="material-pool-card">
            <div class="material-pool-heading">
              <div>
                <strong>Peças disponíveis</strong>
                <small>Arraste uma peça até um grupo ou clique com o botão direito em uma peça para escolher para qual grupo enviar a quantidade selecionada.</small>
              </div>
              <span>${materialCountsValue(board.available)}</span>
            </div>

            <div id="materialPiecePool" class="material-pool-pieces">
              ${renderPieceVisuals(board.available,"pool")}
            </div>
          </div>
        </aside>

        <section class="material-stage material-distribution-stage">
          <div class="material-stage-heading compact">
            <div>
              <span class="stage-number">3</span>
              <div>
                <h2>Distribua entre ${board.divisor} grupos</h2>
                <p>Organize os grupos em partes iguais. Quando houver muitos grupos, use a rolagem para manter a leitura confortável.</p>
              </div>
            </div>
            <div class="divisor-chip">
              <span>DIVISOR</span>
              <strong>${board.divisor}</strong>
            </div>
          </div>

          <div class="material-groups-scroll">
            <div
              class="material-groups-grid"
              style="--md-group-columns:${layout.columns}; min-width:${layout.columns * 286 + Math.max(0,layout.columns - 1) * 14}px;"
            >
              ${board.groups.map((group,index) => `
                <article class="material-group-white" data-material-group="${index}">
                  <header>
                    <div>
                      <strong>Grupo ${index+1}</strong>
                      <span>Valor: ${materialCountsValue(group)}</span>
                    </div>
                    <small>M:${group.M} • C:${group.C} • D:${group.D} • U:${group.U}</small>
                  </header>

                  <div class="material-group-pieces">
                    ${renderPieceVisuals(group,"group",index)}
                  </div>

                  <div class="material-group-drop-note">Arraste peças até aqui. Para devolver, clique em uma peça dentro do grupo.</div>
                </article>
              `).join("")}
            </div>
          </div>

          <div class="material-stage-actions">
            <button id="checkMaterialDistributionBtn" class="btn btn-primary" type="button">✓ CONFERIR O RESULTADO</button>
            <button id="collectMaterialPiecesBtn" class="btn btn-outline" type="button">↺ Recolher todas as peças</button>
            <button id="restartMaterialLabBtn" class="btn btn-outline" type="button">Refazer tudo</button>
          </div>

          <div id="materialDistributionFeedback" class="material-message">
            ${board.solved
              ? `<strong>Parabéns!</strong> Você distribuiu as peças igualmente.`
              : `Distribua as peças entre os grupos e use a conferência para revisar sua estratégia.`}
          </div>

          ${board.solved ? `
            <div class="material-solved-panel">
              <div>
                <span>RESULTADO</span>
                <strong>${board.dividend} ÷ ${board.divisor} = ${quotient}</strong>
              </div>
              <button id="useMaterialResultBtn" class="btn btn-success" type="button">USAR RESULTADO NO EXERCÍCIO</button>
            </div>
          ` : ""}
        </section>
      </section>
    ` : ""}
  `;

  bindMaterialLabEvents();
}

function openMaterialContextMenu(key,x,y){
  const board = state.materialBoard;
  if(!board || !board.confirmed) return;
  if((board.available[key] || 0) <= 0) return;

  const menu = ensureMaterialContextMenu();
  const qty = Math.max(1,Math.min(board.batchQuantity[key] || 1, board.available[key] || 1));

  menu.innerHTML = `
    <div class="material-context-title">Enviar <strong>${qty}</strong> peça(s) de ${pieceLabel(key).toLowerCase()} para:</div>
    <div class="material-context-options">
      ${board.groups.map((group,index) => `<button type="button" data-context-send="${key}" data-context-group="${index}" data-context-qty="${qty}">Grupo ${index+1}</button>`).join("")}
    </div>
  `;

  menu.style.left = `${Math.min(x,window.innerWidth - 340)}px`;
  menu.style.top = `${Math.min(y,window.innerHeight - 260)}px`;
  menu.classList.remove("hidden");

  $$('[data-context-send]',menu).forEach(button => {
    button.addEventListener('click',event => {
      event.stopPropagation();
      moveMaterialPieceToGroup(button.dataset.contextSend,Number(button.dataset.contextGroup),Number(button.dataset.contextQty));
      menu.classList.add('hidden');
    });
  });
}

function bindMaterialLabEvents(){
  const board = state.materialBoard;
  if(!board) return;

  $("#confirmMaterialRepresentationBtn")?.addEventListener("click",() => {
    const value = materialCountsValue(board.available);
    if(value !== board.dividend){
      return toast(`A representação vale ${value}. Monte exatamente ${board.dividend}.`,`error`);
    }
    board.confirmed = true;
    board.phase = 2;
    renderMaterialLab();
    toast("Representação correta. Agora faça trocas e distribua as peças.","success");
  });

  $("#resetMaterialRepresentationBtn")?.addEventListener("click",() => {
    state.materialBoard = createMaterialBoard(board.dividend,board.divisor);
    renderMaterialLab();
  });

  $$('[data-md-plus]').forEach(button => {
    button.addEventListener('click',() => {
      const key = button.dataset.mdPlus;
      board.available[key] += 1;
      board.confirmed = false;
      board.phase = 1;
      board.solved = false;
      renderMaterialLab();
    });
  });

  $$('[data-md-minus]').forEach(button => {
    button.addEventListener('click',() => {
      const key = button.dataset.mdMinus;
      board.available[key] = Math.max(0,board.available[key] - 1);
      board.confirmed = false;
      board.phase = 1;
      board.solved = false;
      renderMaterialLab();
    });
  });

  $$('[data-md-batch-plus]').forEach(button => {
    button.addEventListener('click',() => {
      const key = button.dataset.mdBatchPlus;
      const max = Math.max(1,board.available[key] || 1);
      board.batchQuantity[key] = Math.min(max,(board.batchQuantity[key] || 1) + 1);
      renderMaterialLab();
    });
  });

  $$('[data-md-batch-minus]').forEach(button => {
    button.addEventListener('click',() => {
      const key = button.dataset.mdBatchMinus;
      board.batchQuantity[key] = Math.max(1,(board.batchQuantity[key] || 1) - 1);
      renderMaterialLab();
    });
  });

  $$('[data-md-exchange]').forEach(button => {
    button.addEventListener('click',() => applyMaterialExchange(button.dataset.mdExchange));
  });

  $$('[data-return-piece]').forEach(button => {
    button.addEventListener('click',() => {
      returnMaterialPieceToPool(button.dataset.returnPiece,Number(button.dataset.returnGroup));
    });
  });

  $$('[data-drag-piece]').forEach(piece => {
    piece.addEventListener('dragstart',event => {
      const key = piece.dataset.dragPiece;
      const quantity = Math.max(
        1,
        Math.min(
          Number(board.batchQuantity?.[key] || 1),
          Number(board.available?.[key] || 1)
        )
      );

      event.dataTransfer.setData('text/material-piece',key);
      event.dataTransfer.setData('text/material-count',String(quantity));
      event.dataTransfer.effectAllowed = 'move';
    });

    piece.addEventListener('contextmenu',event => {
      event.preventDefault();
      openMaterialContextMenu(piece.dataset.pieceContext,event.clientX,event.clientY);
    });
  });

  $$('[data-md-pool-cluster]').forEach(cluster => {
    cluster.addEventListener('contextmenu',event => {
      event.preventDefault();
      openMaterialContextMenu(cluster.dataset.mdPoolCluster,event.clientX,event.clientY);
    });
  });

  $$('[data-material-group]').forEach(group => {
    group.addEventListener('dragover',event => {
      event.preventDefault();
      group.classList.add('is-dragover');
    });

    group.addEventListener('dragleave',() => group.classList.remove('is-dragover'));

    group.addEventListener('drop',event => {
      event.preventDefault();
      group.classList.remove('is-dragover');
      const key = event.dataTransfer.getData('text/material-piece');
      const count = Number(event.dataTransfer.getData('text/material-count') || 1);
      const index = Number(group.dataset.materialGroup);

      if(key){
        moveMaterialPieceToGroup(key,index,count);
      }
    });
  });

  $("#collectMaterialPiecesBtn")?.addEventListener('click',() => {
    board.groups.forEach(group => {
      ['M','C','D','U'].forEach(key => {
        board.available[key] += group[key];
        group[key] = 0;
      });
    });
    board.phase = 2;
    board.solved = false;
    renderMaterialLab();
  });

  $("#restartMaterialLabBtn")?.addEventListener('click',() => {
    state.materialBoard = createMaterialBoard(board.dividend,board.divisor);
    renderMaterialLab();
  });

  $("#checkMaterialDistributionBtn")?.addEventListener('click',checkMaterialDistribution);

  $("#useMaterialResultBtn")?.addEventListener('click',() => {
    const quotient = board.dividend / board.divisor;
    closeMaterialLab();
    const answerInput = $("#studentFinalAnswer");
    if(answerInput){
      answerInput.value = String(quotient);
      answerInput.focus();
    }
    toast('Resultado transferido para a resposta final. Revise e envie.','success');
  });
}

function applyMaterialExchange(action){
  const board = state.materialBoard;
  if(!board) return;
  const pool = board.available;
  let valid = true;

  if(action === 'M-C' && pool.M >= 1){
    pool.M -= 1;
    pool.C += 10;
  }else if(action === 'C-D' && pool.C >= 1){
    pool.C -= 1;
    pool.D += 10;
  }else if(action === 'D-U' && pool.D >= 1){
    pool.D -= 1;
    pool.U += 10;
  }else if(action === 'U-D' && pool.U >= 10){
    pool.U -= 10;
    pool.D += 1;
  }else{
    valid = false;
  }

  if(!valid){
    return toast('Não há peças suficientes para realizar essa troca.','error');
  }

  board.phase = Math.max(board.phase,2);
  board.solved = false;
  renderMaterialLab();
}

function moveMaterialPieceToGroup(key,index,count=1){
  const board = state.materialBoard;
  if(!board || !board.confirmed) return;
  if(!['M','C','D','U'].includes(key)) return;
  if(!board.groups[index]) return;

  const amount = Math.max(1,Math.min(Number(count) || 1, board.available[key] || 0));
  if(amount <= 0){
    return toast(`Não há ${pieceLabel(key).toLowerCase()} disponível.`, 'error');
  }

  board.available[key] -= amount;
  board.groups[index][key] += amount;
  board.phase = Math.max(board.phase,3);
  board.solved = false;
  renderMaterialLab();
}

function returnMaterialPieceToPool(key,index){
  const board = state.materialBoard;
  if(!board || !board.groups[index]) return;
  if(board.groups[index][key] <= 0) return;
  board.groups[index][key] -= 1;
  board.available[key] += 1;
  board.solved = false;
  renderMaterialLab();
}

function checkMaterialDistribution(){
  const board = state.materialBoard;
  if(!board) return;

  const quotient = board.dividend / board.divisor;
  const poolValue = materialCountsValue(board.available);
  const values = board.groups.map(materialCountsValue);
  const allEqual = values.every(value => value === quotient);
  const correctTotal = materialTotalValue(board) === board.dividend;

  if(Number.isInteger(quotient) && poolValue === 0 && allEqual && correctTotal){
    board.phase = 4;
    board.solved = true;
    renderMaterialLab();
    toast('Distribuição correta. Parabéns!','success');
    return;
  }

  if(!Number.isInteger(quotient)){
    const feedback = $("#materialDistributionFeedback");
    if(feedback){
      feedback.innerHTML =
        "Continue usando as peças para representar sua estratégia. Esta atividade poderá ser revisada posteriormente pelo professor.";
    }
    toast("Revise a distribuição com a orientação do professor.","info");
    return;
  }

  const feedback = $("#materialDistributionFeedback");
  if(feedback){
    if(poolValue > 0){
      feedback.innerHTML = `Ainda existem peças fora dos grupos. Continue distribuindo até usar todas elas.`;
    }else{
      feedback.innerHTML = `Os grupos ainda não têm o mesmo valor. Revise a distribuição ou faça novas trocas.`;
    }
  }

  toast('A distribuição ainda precisa ser ajustada.','error');
}


/* ============================================================
   PROJETO EDUCACIONAL 7.0 — MATERIAL DOURADO TELA CHEIA
   Atualização consolidada 14/10/2026
   ============================================================ */

function deepCloneMaterial(value){
  return JSON.parse(JSON.stringify(value));
}

function createMaterialBoard(dividend,divisor){
  return {
    dividend:Number(dividend),
    divisor:Number(divisor),
    confirmed:false,
    phase:1,
    available:{M:0,C:0,D:0,U:0},
    groups:Array.from({length:Number(divisor)},() => ({M:0,C:0,D:0,U:0})),
    solved:false,
    batchQuantity:{M:1,C:1,D:1,U:1},
    history:[]
  };
}

function normalizeMaterialBoard(board,dividend,divisor){
  if(!board || Number(board.dividend) !== Number(dividend) || Number(board.divisor) !== Number(divisor)){
    return createMaterialBoard(dividend,divisor);
  }

  const normalized = createMaterialBoard(dividend,divisor);
  normalized.confirmed = Boolean(board.confirmed);
  normalized.phase = Math.max(1,Number(board.phase || 1));
  normalized.solved = Boolean(board.solved);

  ["M","C","D","U"].forEach(key => {
    normalized.available[key] = Math.max(0,Number(board.available?.[key] || 0));
    normalized.batchQuantity[key] = Math.max(1,Number(board.batchQuantity?.[key] || 1));
  });

  if(Array.isArray(board.groups)){
    normalized.groups = Array.from({length:Number(divisor)},(_,index) => {
      const source = board.groups[index] || {};
      return {
        M:Math.max(0,Number(source.M || 0)),
        C:Math.max(0,Number(source.C || 0)),
        D:Math.max(0,Number(source.D || 0)),
        U:Math.max(0,Number(source.U || 0))
      };
    });
  }

  normalized.history = Array.isArray(board.history)
    ? board.history.slice(-250)
    : [];

  return normalized;
}

function serializeMaterialBoard(board=state.materialBoard){
  if(!board) return null;

  return {
    dividend:Number(board.dividend),
    divisor:Number(board.divisor),
    confirmed:Boolean(board.confirmed),
    phase:Number(board.phase || 1),
    solved:Boolean(board.solved),
    available:{
      M:Number(board.available?.M || 0),
      C:Number(board.available?.C || 0),
      D:Number(board.available?.D || 0),
      U:Number(board.available?.U || 0)
    },
    groups:(board.groups || []).map(group => ({
      M:Number(group.M || 0),
      C:Number(group.C || 0),
      D:Number(group.D || 0),
      U:Number(group.U || 0)
    })),
    batchQuantity:{
      M:Number(board.batchQuantity?.M || 1),
      C:Number(board.batchQuantity?.C || 1),
      D:Number(board.batchQuantity?.D || 1),
      U:Number(board.batchQuantity?.U || 1)
    },
    history:Array.isArray(board.history) ? board.history.slice(-250) : []
  };
}

function getSavedMaterialBoard(dividend,divisor){
  const data = loadData();
  const submission = getCurrentSubmission(data);
  const raw = submission?.materialProgress?.board || submission?.materialProgress || null;

  if(!raw) return null;
  return normalizeMaterialBoard(raw,dividend,divisor);
}

function compactMaterialSnapshot(board=state.materialBoard){
  if(!board) return null;

  return {
    pool:{...board.available},
    groupValues:board.groups.map(group => materialCountsValue(group)),
    phase:board.phase,
    solved:Boolean(board.solved)
  };
}

function recordMaterialMovement(action,details={}){
  const board = state.materialBoard;
  if(!board) return;

  if(!Array.isArray(board.history)) board.history = [];

  board.history.push({
    at:new Date().toISOString(),
    action,
    details,
    state:compactMaterialSnapshot(board)
  });

  if(board.history.length > 250){
    board.history = board.history.slice(-250);
  }

  // Na tela normal, as movimentações são protegidas automaticamente.
  // Nos ambientes full-screen, o aluno escolhe ao sair se deseja salvar.
  if(!state.materialFullscreenMode){
    saveMaterialProgress(action);
  }
}

function saveMaterialProgress(reason="progresso"){
  if(!state.student || !state.currentActivity || !state.materialBoard) return;

  const data = loadData();
  const submission = getCurrentSubmission(data);
  if(!submission) return;

  submission.materialProgress = {
    board:serializeMaterialBoard(state.materialBoard),
    savedAt:new Date().toISOString(),
    reason
  };
  submission.updatedAt = new Date().toISOString();

  saveData(data);
}

function setMaterialFullscreenSnapshot(mode){
  state.materialFullscreenMode = mode;
  state.materialFullscreenSnapshot = deepCloneMaterial(serializeMaterialBoard(state.materialBoard));
}

function clearMaterialFullscreenState(){
  state.materialFullscreenMode = null;
  state.materialFullscreenSnapshot = null;
  state.materialExitSource = null;
}

function hideMaterialFullscreenOverlays(){
  $("#materialRepresentationFullscreen")?.classList.add("hidden");
  $("#materialWorkspaceFullscreen")?.classList.add("hidden");
  $("#materialExitModal")?.classList.add("hidden");
  document.body.classList.remove("material-overlay-open");
}

function openMaterialLab(){
  const item = state.currentActivity;
  if(!item) return;

  saveCurrentProgress();

  const {dividend,divisor} = inferMaterialOperands(item);
  state.materialBoard =
    getSavedMaterialBoard(dividend,divisor) ||
    createMaterialBoard(dividend,divisor);

  $("#materialLabTitle").textContent = item.title || "Divisão com Material Dourado";
  $("#materialLabStatement").textContent = item.statement || "";
  $("#materialLabOperation").textContent = `${dividend} ÷ ${divisor}`;
  $("#materialLabQuestion").textContent = item.question || "";

  renderMaterialLab();
  showScreen("screenMaterialLab");
}

function closeMaterialLab(){
  saveMaterialProgress("voltar ao exercício");
  hideMaterialFullscreenOverlays();
  clearMaterialFullscreenState();
  showScreen("screenStudentActivity");
  $("#activityTimerDisplay").textContent = timerText(state.activeSeconds);
  autoGrowScratchField();
}

function premiumPieceMarkup(key,count){
  const safeCount = Math.max(0,Number(count || 0));
  const maxVisible = key === "D" ? 10 : key === "U" ? 12 : 4;
  const visible = Math.min(safeCount,maxVisible);

  if(!safeCount){
    return `<div class="gold3d gold3d-${key} gold3d-ghost" aria-hidden="true"></div>`;
  }

  const pieces = Array.from({length:visible},() =>
    `<div class="gold3d gold3d-${key}" aria-hidden="true"></div>`
  ).join("");

  const extra = safeCount > visible
    ? `<span class="md-more-pieces">+${safeCount-visible}</span>`
    : "";

  return `${pieces}${extra}`;
}

function renderRepresentationFullscreen(){
  const board = state.materialBoard;
  const root = $("#materialRepresentationFullscreenRoot");
  if(!board || !root) return;

  const representedValue = materialCountsValue(board.available);
  const correct = representedValue === board.dividend;

  root.innerHTML = `
    <div class="material-fs-shell">
      <header class="material-fs-header">
        <div class="material-fs-title">
          <span class="kicker">DIVISÃO COM MATERIAL DOURADO</span>
          <h1>Represente o dividendo</h1>
          <p>Monte ${board.dividend} usando milhar, centena, dezena e unidade.</p>
        </div>

        <div class="material-fs-header-actions">
          <div class="material-fs-chip">
            <span>DIVISOR</span>
            <strong>${board.divisor}</strong>
          </div>
          <button id="repBackExerciseBtn" class="material-fs-button" type="button">VOLTAR AO EXERCÍCIO</button>
          <button id="repExitBtn" class="material-fs-button danger" type="button">SAIR</button>
        </div>
      </header>

      <section class="material-fs-section">
        <div class="material-fs-section-heading">
          <div>
            <h2>Peças disponíveis para representar</h2>
            <p>Use os botões + e −. As peças foram ampliadas para facilitar a leitura e a manipulação.</p>
          </div>

          <div class="material-fs-target">
            <span>Número a representar</span>
            <strong>${board.dividend}</strong>
          </div>
        </div>

        <div class="premium-representation-grid">
          ${[
            ["M","MILHAR","1000"],
            ["C","CENTENA","100"],
            ["D","DEZENA","10"],
            ["U","UNIDADE","1"]
          ].map(([key,label,value]) => `
            <article class="premium-piece-card">
              <header>
                <strong>${label}</strong>
                <span>vale ${value}</span>
              </header>

              <div class="premium-art-stage">
                <div class="premium-art-items">
                  ${premiumPieceMarkup(key,board.available[key])}
                </div>
              </div>

              <div class="premium-count-controls">
                <button type="button" data-fs-rep-minus="${key}" aria-label="Retirar ${label.toLowerCase()}">−</button>
                <strong>${board.available[key]} peça(s)</strong>
                <button type="button" data-fs-rep-plus="${key}" aria-label="Adicionar ${label.toLowerCase()}">+</button>
              </div>
            </article>
          `).join("")}
        </div>

        <div class="material-fs-status ${correct ? "" : "is-pending"}">
          <span>${correct ? "Representação pronta para confirmação." : "Monte o número e confirme quando terminar."}</span>
        </div>

        <div class="material-fs-footer-actions">
          <button id="repResetBtn" class="material-fs-button" type="button">REFAZER REPRESENTAÇÃO</button>
          <button id="repConfirmBtn" class="material-fs-button primary" type="button">✓ CONFIRMAR REPRESENTAÇÃO ?</button>
          <button id="repBackExerciseBottomBtn" class="material-fs-button" type="button">VOLTAR AO EXERCÍCIO</button>
          <button id="repExitBottomBtn" class="material-fs-button danger" type="button">SAIR</button>
        </div>
      </section>
    </div>
  `;

  bindRepresentationFullscreenEvents(root);
}

function openRepresentationFullscreen(){
  if(!state.materialBoard) return;

  setMaterialFullscreenSnapshot("representation");
  $("#materialRepresentationFullscreen")?.classList.remove("hidden");
  document.body.classList.add("material-overlay-open");
  renderRepresentationFullscreen();
}

function bindRepresentationFullscreenEvents(root){
  const board = state.materialBoard;
  if(!board) return;

  root.querySelectorAll("[data-fs-rep-plus]").forEach(button => {
    button.addEventListener("click",() => {
      const key = button.dataset.fsRepPlus;
      board.available[key] += 1;
      board.confirmed = false;
      board.phase = 1;
      board.solved = false;
      recordMaterialMovement("adicionar peça na representação",{piece:key});
      renderRepresentationFullscreen();
    });
  });

  root.querySelectorAll("[data-fs-rep-minus]").forEach(button => {
    button.addEventListener("click",() => {
      const key = button.dataset.fsRepMinus;
      board.available[key] = Math.max(0,board.available[key] - 1);
      board.confirmed = false;
      board.phase = 1;
      board.solved = false;
      recordMaterialMovement("retirar peça da representação",{piece:key});
      renderRepresentationFullscreen();
    });
  });

  $("#repResetBtn")?.addEventListener("click",() => {
    board.available = {M:0,C:0,D:0,U:0};
    board.confirmed = false;
    board.phase = 1;
    board.solved = false;
    recordMaterialMovement("refazer representação");
    renderRepresentationFullscreen();
  });

  $("#repConfirmBtn")?.addEventListener("click",() => {
    const represented = materialCountsValue(board.available);

    if(represented !== board.dividend){
      return toast(`A representação vale ${represented}. Monte exatamente ${board.dividend}.`,"error");
    }

    board.confirmed = true;
    board.phase = Math.max(2,board.phase);
    board.solved = false;
    recordMaterialMovement("confirmar representação",{value:represented});
    saveMaterialProgress("representação confirmada");

    $("#materialRepresentationFullscreen")?.classList.add("hidden");
    clearMaterialFullscreenState();
    document.body.classList.remove("material-overlay-open");
    renderMaterialLab();
    toast("Representação correta. Agora faça trocas e distribua as peças.","success");
  });

  const backToExercise = () => {
    saveMaterialProgress("voltar ao exercício pela representação");
    hideMaterialFullscreenOverlays();
    clearMaterialFullscreenState();
    showScreen("screenStudentActivity");
    autoGrowScratchField();
  };

  $("#repBackExerciseBtn")?.addEventListener("click",backToExercise);
  $("#repBackExerciseBottomBtn")?.addEventListener("click",backToExercise);

  $("#repExitBtn")?.addEventListener("click",() => openMaterialExitDialog("representation"));
  $("#repExitBottomBtn")?.addEventListener("click",() => openMaterialExitDialog("representation"));
}

function renderMaterialLab(){
  const board = state.materialBoard;
  const root = $("#materialLabRoot");
  if(!board || !root) return;

  const quotient = board.dividend / board.divisor;
  const layout = materialGroupLayout(board.groups.length);

  root.innerHTML = `
    <div class="material-lab-steps">
      <button id="openRepresentationStepBtn"
              class="material-lab-step material-lab-step-button ${board.confirmed ? "done" : "active"}"
              type="button">
        <span>1</span>
        <strong>Representar</strong>
      </button>

      ${[
        ["2","Trocar"],
        ["3","Distribuir"],
        ["4","Conferir"]
      ].map(([number,label],index) => {
        const step = index + 2;
        const status = board.solved ? "done" : step < board.phase ? "done" : step === board.phase ? "active" : "";
        return `
          <div class="material-lab-step ${status}">
            <span>${number}</span>
            <strong>${label}</strong>
          </div>
        `;
      }).join("")}
    </div>

    <section class="material-stage material-launch-stage">
      <div class="material-launch-copy">
        <div class="material-stage-heading compact">
          <div>
            <span class="stage-number">1</span>
            <div>
              <h2>Representação do dividendo</h2>
              <p>Abra a representação em tela cheia para montar ${board.dividend} com Material Dourado.</p>
            </div>
          </div>
        </div>

        <div class="material-launch-summary">
          <span>Dividendo: ${board.dividend}</span>
          <span>Divisor: ${board.divisor}</span>
          <span>${board.confirmed ? "Representação confirmada" : "Representação pendente"}</span>
        </div>
      </div>

      <button id="openRepresentationFullscreenBtn" class="btn btn-primary" type="button">
        ${board.confirmed ? "REVISAR REPRESENTAÇÃO EM TELA CHEIA" : "REPRESENTAR EM TELA CHEIA"}
      </button>
    </section>

    ${board.confirmed ? `
      <div class="material-fullscreen-launch">
        <button id="openMaterialWorkspaceFullscreenBtn" class="btn btn-primary" type="button">
          REALIZAR TROCAS E DISTRIBUIÇÃO NOS GRUPOS EM TELA CHEIA
        </button>
      </div>

      <section class="material-workspace-grid">
        <aside class="material-stage material-exchange-stage">
          <div class="material-stage-heading compact">
            <div>
              <span class="stage-number">2</span>
              <div>
                <h2>Trocas</h2>
                <p>Faça trocas sem alterar o valor representado.</p>
              </div>
            </div>
          </div>

          <div class="exchange-lines">
            <button type="button" class="exchange-line" data-md-exchange="M-C">
              <strong>1 milhar → 10 centenas</strong>
              <small>Transforme uma peça de milhar em centenas.</small>
            </button>

            <button type="button" class="exchange-line" data-md-exchange="C-D">
              <strong>1 centena → 10 dezenas</strong>
              <small>Transforme uma peça de centena em dezenas.</small>
            </button>

            <button type="button" class="exchange-line" data-md-exchange="D-U">
              <strong>1 dezena → 10 unidades</strong>
              <small>Transforme uma peça de dezena em unidades.</small>
            </button>

            <button type="button" class="exchange-line" data-md-exchange="U-D">
              <strong>10 unidades → 1 dezena</strong>
              <small>Reagrupe dez unidades em uma dezena.</small>
            </button>
          </div>

          <div class="material-pool-card">
            <div class="material-pool-heading">
              <div>
                <strong>Peças disponíveis</strong>
                <small>
                  Arraste uma peça até um grupo ou clique com o botão direito
                  em uma peça para escolher o grupo de destino.
                </small>
              </div>
              <span>${materialCountsValue(board.available)}</span>
            </div>

            <div class="material-pool-pieces">
              ${renderPieceVisuals(board.available,"pool")}
            </div>
          </div>
        </aside>

        <section class="material-stage material-distribution-stage">
          <div class="material-stage-heading compact">
            <div>
              <span class="stage-number">3</span>
              <div>
                <h2>Distribua entre ${board.divisor} grupos</h2>
                <p>Organize os grupos em partes iguais. A área usa toda a largura disponível.</p>
              </div>
            </div>

            <div class="divisor-chip">
              <span>DIVISOR</span>
              <strong>${board.divisor}</strong>
            </div>
          </div>

          <div class="material-groups-scroll">
            <div class="material-groups-grid"
                 style="--md-group-columns:${layout.columns}; min-width:${layout.columns * 286 + Math.max(0,layout.columns - 1) * 14}px;">
              ${board.groups.map((group,index) => `
                <article class="material-group-white" data-material-group="${index}">
                  <header>
                    <div>
                      <strong>Grupo ${index+1}</strong>
                      <span>Valor: ${materialCountsValue(group)}</span>
                    </div>
                    <small>M:${group.M} • C:${group.C} • D:${group.D} • U:${group.U}</small>
                  </header>

                  <div class="material-group-pieces">
                    ${renderPieceVisuals(group,"group",index)}
                  </div>

                  <div class="material-group-drop-note">
                    Arraste peças até aqui. Para devolver, clique em uma peça dentro do grupo.
                  </div>
                </article>
              `).join("")}
            </div>
          </div>

          <div class="material-stage-actions material-bottom-actions">
            <button id="checkMaterialDistributionBtn" class="btn btn-primary" type="button">✓ CONFERIR O RESULTADO</button>
            <button id="collectMaterialPiecesBtn" class="btn btn-outline" type="button">↺ Recolher todas as peças</button>
            <button id="restartMaterialLabBtn" class="btn btn-outline" type="button">Refazer tudo</button>
            <button id="backToExerciseFromGroupsBtn" class="btn btn-outline" type="button">VOLTAR AO EXERCÍCIO</button>
          </div>

          <div id="materialDistributionFeedback" class="material-message">
            ${board.solved
              ? `<strong>Parabéns!</strong> Você distribuiu as peças igualmente.`
              : `Distribua as peças entre os grupos e use a conferência para revisar sua estratégia.`}
          </div>

          ${board.solved ? `
            <div class="material-solved-panel">
              <div>
                <span>RESULTADO</span>
                <strong>${board.dividend} ÷ ${board.divisor} = ${quotient}</strong>
              </div>
              <button id="useMaterialResultBtn" class="btn btn-success" type="button">USAR RESULTADO NO EXERCÍCIO</button>
            </div>
          ` : ""}
        </section>
      </section>
    ` : ""}
  `;

  bindMaterialControls(root,"normal");
}

function renderMaterialWorkspaceFullscreen(){
  const board = state.materialBoard;
  const root = $("#materialWorkspaceFullscreenRoot");
  if(!board || !root) return;

  const layout = materialGroupLayout(board.groups.length);
  const quotient = board.dividend / board.divisor;

  root.innerHTML = `
    <div class="material-fs-shell">
      <header class="material-fs-header">
        <div class="material-fs-title">
          <span class="kicker">MATERIAL DOURADO — TELA AMPLIADA</span>
          <h1>Trocas e distribuição nos grupos</h1>
          <p>Faça as trocas, escolha a quantidade e distribua as peças com mais espaço visual.</p>
        </div>

        <div class="material-fs-header-actions">
          <div class="material-fs-chip">
            <span>DIVIDENDO</span>
            <strong>${board.dividend}</strong>
          </div>
          <div class="material-fs-chip">
            <span>DIVISOR</span>
            <strong>${board.divisor}</strong>
          </div>
          <button id="workspaceBackNormalBtn" class="material-fs-button" type="button">VOLTAR À TELA NORMAL</button>
          <button id="workspaceBackExerciseTopBtn" class="material-fs-button" type="button">VOLTAR AO EXERCÍCIO</button>
          <button id="workspaceExitBtn" class="material-fs-button danger" type="button">SAIR</button>
        </div>
      </header>

      <div class="material-fs-workspace">
        <aside class="material-fs-exchanges">
          <div class="material-fs-panel-title">
            <div>
              <h2>2. Trocas</h2>
              <p>Faça trocas sem alterar o valor representado.</p>
            </div>
          </div>

          <div class="premium-exchange-list">
            ${[
              ["M-C","1 milhar","10 centenas","Transforme uma peça de milhar em centenas."],
              ["C-D","1 centena","10 dezenas","Transforme uma peça de centena em dezenas."],
              ["D-U","1 dezena","10 unidades","Transforme uma peça de dezena em unidades."],
              ["U-D","10 unidades","1 dezena","Reagrupe dez unidades em uma dezena."]
            ].map(([action,from,to,desc]) => `
              <button type="button" class="premium-exchange-button" data-md-exchange="${action}">
                <div>
                  <strong>${from}</strong>
                  <small>${desc}</small>
                </div>
                <span class="arrow">→</span>
                <strong>${to}</strong>
              </button>
            `).join("")}
          </div>

          <div class="material-fs-pool">
            <div class="material-pool-heading">
              <div>
                <strong>Peças disponíveis</strong>
                <small>
                  Selecione a quantidade para envio rápido. Arraste as peças
                  ou use o botão direito para escolher o grupo.
                </small>
              </div>
              <span>${materialCountsValue(board.available)}</span>
            </div>

            <div class="material-pool-pieces">
              ${renderPieceVisuals(board.available,"pool")}
            </div>
          </div>
        </aside>

        <section class="material-fs-groups-panel">
          <div class="material-fs-panel-title">
            <div>
              <h2>3. Distribua entre ${board.divisor} grupos</h2>
              <p>Os cartões se ajustam ao número de grupos e preservam a legibilidade.</p>
            </div>
          </div>

          <div class="material-fs-groups-scroll">
            <div class="material-fs-groups-grid"
                 style="--md-group-columns:${layout.columns}; min-width:${layout.columns * 257 + Math.max(0,layout.columns - 1) * 12}px;">
              ${board.groups.map((group,index) => `
                <article class="material-group-white" data-material-group="${index}">
                  <header>
                    <div>
                      <strong>Grupo ${index+1}</strong>
                      <span>Valor: ${materialCountsValue(group)}</span>
                    </div>
                    <small>M:${group.M} • C:${group.C} • D:${group.D} • U:${group.U}</small>
                  </header>

                  <div class="material-group-pieces">
                    ${renderPieceVisuals(group,"group",index)}
                  </div>

                  <div class="material-group-drop-note">
                    Arraste as peças até aqui. Clique em uma peça do grupo para devolvê-la.
                  </div>
                </article>
              `).join("")}
            </div>
          </div>

          <div class="material-fs-controls">
            <button id="fsCheckMaterialDistributionBtn" class="material-fs-button primary" type="button">✓ CONFERIR O RESULTADO</button>
            <button id="fsCollectMaterialPiecesBtn" class="material-fs-button" type="button">↺ RECOLHER TODAS AS PEÇAS</button>
            <button id="fsRestartMaterialLabBtn" class="material-fs-button" type="button">REFAZER TUDO</button>
            <button id="workspaceBackExerciseBottomBtn" class="material-fs-button gold" type="button">VOLTAR AO EXERCÍCIO</button>
          </div>

          <div id="fsMaterialDistributionFeedback" class="material-fs-feedback">
            ${board.solved
              ? `<strong>Parabéns!</strong> A distribuição foi conferida.`
              : `Distribua as peças entre os grupos e use a conferência para revisar sua estratégia.`}
          </div>

          ${board.solved ? `
            <div class="material-fs-result">
              <div>
                <span>RESULTADO</span>
                <strong>${board.dividend} ÷ ${board.divisor} = ${quotient}</strong>
              </div>
              <button id="fsUseMaterialResultBtn" class="material-fs-button primary" type="button">USAR RESULTADO NO EXERCÍCIO</button>
            </div>
          ` : ""}
        </section>
      </div>
    </div>
  `;

  bindMaterialControls(root,"fullscreen");
}

function openMaterialWorkspaceFullscreen(){
  const board = state.materialBoard;
  if(!board?.confirmed) return;

  setMaterialFullscreenSnapshot("workspace");
  $("#materialWorkspaceFullscreen")?.classList.remove("hidden");
  document.body.classList.add("material-overlay-open");
  renderMaterialWorkspaceFullscreen();
}

function refreshMaterialViews(){
  renderMaterialLab();

  if(state.materialFullscreenMode === "representation"){
    renderRepresentationFullscreen();
  }else if(state.materialFullscreenMode === "workspace"){
    renderMaterialWorkspaceFullscreen();
  }
}

function bindMaterialControls(root,mode="normal"){
  const board = state.materialBoard;
  if(!board || !root) return;

  root.querySelector("#openRepresentationStepBtn")?.addEventListener("click",openRepresentationFullscreen);
  root.querySelector("#openRepresentationFullscreenBtn")?.addEventListener("click",openRepresentationFullscreen);
  root.querySelector("#openMaterialWorkspaceFullscreenBtn")?.addEventListener("click",openMaterialWorkspaceFullscreen);

  root.querySelectorAll("[data-md-batch-plus]").forEach(button => {
    button.addEventListener("click",() => {
      const key = button.dataset.mdBatchPlus;
      const max = Math.max(1,board.available[key] || 1);
      board.batchQuantity[key] = Math.min(max,(board.batchQuantity[key] || 1) + 1);
      recordMaterialMovement("alterar quantidade de envio",{piece:key,quantity:board.batchQuantity[key]});
      refreshMaterialViews();
    });
  });

  root.querySelectorAll("[data-md-batch-minus]").forEach(button => {
    button.addEventListener("click",() => {
      const key = button.dataset.mdBatchMinus;
      board.batchQuantity[key] = Math.max(1,(board.batchQuantity[key] || 1) - 1);
      recordMaterialMovement("alterar quantidade de envio",{piece:key,quantity:board.batchQuantity[key]});
      refreshMaterialViews();
    });
  });

  root.querySelectorAll("[data-md-exchange]").forEach(button => {
    button.addEventListener("click",() => applyMaterialExchange(button.dataset.mdExchange));
  });

  root.querySelectorAll("[data-return-piece]").forEach(button => {
    button.addEventListener("click",() => {
      returnMaterialPieceToPool(button.dataset.returnPiece,Number(button.dataset.returnGroup));
    });
  });

  root.querySelectorAll("[data-drag-piece]").forEach(piece => {
    piece.addEventListener("dragstart",event => {
      const key = piece.dataset.dragPiece;
      const quantity = Math.max(
        1,
        Math.min(
          Number(board.batchQuantity?.[key] || 1),
          Number(board.available?.[key] || 1)
        )
      );

      event.dataTransfer.setData("text/material-piece",key);
      event.dataTransfer.setData("text/material-count",String(quantity));
      event.dataTransfer.effectAllowed = "move";
    });

    piece.addEventListener("contextmenu",event => {
      event.preventDefault();
      state.materialContextSourceMode = mode;
      openMaterialContextMenu(piece.dataset.pieceContext,event.clientX,event.clientY);
    });
  });

  root.querySelectorAll("[data-md-pool-cluster]").forEach(cluster => {
    cluster.addEventListener("contextmenu",event => {
      event.preventDefault();
      state.materialContextSourceMode = mode;
      openMaterialContextMenu(cluster.dataset.mdPoolCluster,event.clientX,event.clientY);
    });
  });

  root.querySelectorAll("[data-material-group]").forEach(group => {
    group.addEventListener("dragover",event => {
      event.preventDefault();
      group.classList.add("is-dragover");
    });

    group.addEventListener("dragleave",() => group.classList.remove("is-dragover"));

    group.addEventListener("drop",event => {
      event.preventDefault();
      group.classList.remove("is-dragover");

      const key = event.dataTransfer.getData("text/material-piece");
      const count = Number(event.dataTransfer.getData("text/material-count") || 1);
      const index = Number(group.dataset.materialGroup);

      if(key){
        moveMaterialPieceToGroup(key,index,count);
      }
    });
  });

  root.querySelector("#collectMaterialPiecesBtn")?.addEventListener("click",collectAllMaterialPieces);
  root.querySelector("#fsCollectMaterialPiecesBtn")?.addEventListener("click",collectAllMaterialPieces);

  root.querySelector("#restartMaterialLabBtn")?.addEventListener("click",restartMaterialBoard);
  root.querySelector("#fsRestartMaterialLabBtn")?.addEventListener("click",restartMaterialBoard);

  root.querySelector("#checkMaterialDistributionBtn")?.addEventListener("click",checkMaterialDistribution);
  root.querySelector("#fsCheckMaterialDistributionBtn")?.addEventListener("click",checkMaterialDistribution);

  const backExercise = () => {
    saveMaterialProgress("voltar ao exercício após distribuição");
    hideMaterialFullscreenOverlays();
    clearMaterialFullscreenState();
    showScreen("screenStudentActivity");
    autoGrowScratchField();
  };

  root.querySelector("#backToExerciseFromGroupsBtn")?.addEventListener("click",backExercise);
  root.querySelector("#workspaceBackExerciseTopBtn")?.addEventListener("click",backExercise);
  root.querySelector("#workspaceBackExerciseBottomBtn")?.addEventListener("click",backExercise);

  root.querySelector("#workspaceBackNormalBtn")?.addEventListener("click",() => {
    saveMaterialProgress("retorno à visualização normal");
    $("#materialWorkspaceFullscreen")?.classList.add("hidden");
    clearMaterialFullscreenState();
    document.body.classList.remove("material-overlay-open");
    renderMaterialLab();
  });

  root.querySelector("#workspaceExitBtn")?.addEventListener("click",() => openMaterialExitDialog("workspace"));

  root.querySelector("#useMaterialResultBtn")?.addEventListener("click",useMaterialResultInExercise);
  root.querySelector("#fsUseMaterialResultBtn")?.addEventListener("click",useMaterialResultInExercise);
}

function applyMaterialExchange(action){
  const board = state.materialBoard;
  if(!board) return;

  const pool = board.available;
  let valid = true;
  let description = action;

  if(action === "M-C" && pool.M >= 1){
    pool.M -= 1;
    pool.C += 10;
    description = "1 milhar → 10 centenas";
  }else if(action === "C-D" && pool.C >= 1){
    pool.C -= 1;
    pool.D += 10;
    description = "1 centena → 10 dezenas";
  }else if(action === "D-U" && pool.D >= 1){
    pool.D -= 1;
    pool.U += 10;
    description = "1 dezena → 10 unidades";
  }else if(action === "U-D" && pool.U >= 10){
    pool.U -= 10;
    pool.D += 1;
    description = "10 unidades → 1 dezena";
  }else{
    valid = false;
  }

  if(!valid){
    return toast("Não há peças suficientes para realizar essa troca.","error");
  }

  board.phase = Math.max(board.phase,2);
  board.solved = false;
  recordMaterialMovement("troca",{exchange:description});
  refreshMaterialViews();
}

function moveMaterialPieceToGroup(key,index,count=1){
  const board = state.materialBoard;
  if(!board || !board.confirmed) return;
  if(!["M","C","D","U"].includes(key)) return;
  if(!board.groups[index]) return;

  const amount = Math.max(1,Math.min(Number(count) || 1,board.available[key] || 0));

  if(amount <= 0){
    return toast(`Não há ${pieceLabel(key).toLowerCase()} disponível.`,"error");
  }

  board.available[key] -= amount;
  board.groups[index][key] += amount;
  board.phase = Math.max(board.phase,3);
  board.solved = false;

  recordMaterialMovement("enviar peça ao grupo",{
    piece:key,
    quantity:amount,
    group:index+1
  });

  refreshMaterialViews();
}

function returnMaterialPieceToPool(key,index){
  const board = state.materialBoard;
  if(!board || !board.groups[index]) return;
  if(board.groups[index][key] <= 0) return;

  board.groups[index][key] -= 1;
  board.available[key] += 1;
  board.solved = false;

  recordMaterialMovement("devolver peça ao conjunto disponível",{
    piece:key,
    quantity:1,
    group:index+1
  });

  refreshMaterialViews();
}

function collectAllMaterialPieces(){
  const board = state.materialBoard;
  if(!board) return;

  board.groups.forEach(group => {
    ["M","C","D","U"].forEach(key => {
      board.available[key] += group[key];
      group[key] = 0;
    });
  });

  board.phase = 2;
  board.solved = false;
  recordMaterialMovement("recolher todas as peças");
  refreshMaterialViews();
}

function restartMaterialBoard(){
  const board = state.materialBoard;
  if(!board) return;

  const history = Array.isArray(board.history) ? board.history.slice(-249) : [];
  const fresh = createMaterialBoard(board.dividend,board.divisor);
  fresh.history = history;
  state.materialBoard = fresh;

  recordMaterialMovement("refazer tudo");
  refreshMaterialViews();
}

function checkMaterialDistribution(){
  const board = state.materialBoard;
  if(!board) return;

  const quotient = board.dividend / board.divisor;
  const poolValue = materialCountsValue(board.available);
  const values = board.groups.map(materialCountsValue);
  const allEqual = values.every(value => value === quotient);
  const correctTotal = materialTotalValue(board) === board.dividend;

  if(Number.isInteger(quotient) && poolValue === 0 && allEqual && correctTotal){
    board.phase = 4;
    board.solved = true;
    recordMaterialMovement("conferir distribuição",{result:"correta"});
    saveMaterialProgress("distribuição correta");
    refreshMaterialViews();
    toast("Distribuição correta. Parabéns!","success");
    return;
  }

  board.solved = false;
  recordMaterialMovement("conferir distribuição",{
    result:"revisar",
    remainingPool:poolValue
  });

  const normalFeedback = $("#materialDistributionFeedback");
  const fsFeedback = $("#fsMaterialDistributionFeedback");

  let message = "A distribuição ainda precisa ser ajustada.";

  if(!Number.isInteger(quotient)){
    message = "Continue usando as peças para representar sua estratégia. Esta atividade poderá ser revisada posteriormente pelo professor.";
  }else if(poolValue > 0){
    message = "Ainda existem peças fora dos grupos. Continue distribuindo até usar todas elas.";
  }else{
    message = "Os grupos ainda não têm o mesmo valor. Revise a distribuição ou faça novas trocas.";
  }

  if(normalFeedback) normalFeedback.textContent = message;
  if(fsFeedback) fsFeedback.textContent = message;

  if(!state.materialFullscreenMode){
    saveMaterialProgress("conferência da distribuição");
  }

  toast("Revise a distribuição.","info");
}

function useMaterialResultInExercise(){
  const board = state.materialBoard;
  if(!board) return;

  const quotient = board.dividend / board.divisor;
  saveMaterialProgress("resultado levado ao exercício");

  hideMaterialFullscreenOverlays();
  clearMaterialFullscreenState();
  showScreen("screenStudentActivity");

  const answerInput = $("#studentFinalAnswer");
  if(answerInput){
    answerInput.value = String(quotient);
    answerInput.focus();
  }

  autoGrowScratchField();
  toast("Resultado transferido para a resposta final. Revise e envie.","success");
}

function openMaterialExitDialog(source){
  state.materialExitSource = source || state.materialFullscreenMode || "workspace";
  $("#materialExitModal")?.classList.remove("hidden");
}

function materialExitWithoutSave(){
  const snapshot = state.materialFullscreenSnapshot;

  if(snapshot){
    state.materialBoard = normalizeMaterialBoard(
      snapshot,
      snapshot.dividend,
      snapshot.divisor
    );
  }

  hideMaterialFullscreenOverlays();
  clearMaterialFullscreenState();
  renderMaterialLab();
  showScreen("screenStudentActivity");
  autoGrowScratchField();
  toast("As alterações desta tela não foram salvas.","info");
}

function materialExitWithSave(){
  saveMaterialProgress("saída com progresso salvo");
  hideMaterialFullscreenOverlays();
  clearMaterialFullscreenState();
  renderMaterialLab();
  showScreen("screenStudentActivity");
  autoGrowScratchField();
  toast("Progresso do Material Dourado salvo.","success");
}

/* Atualiza o menu de contexto para respeitar o modo atual. */
function openMaterialContextMenu(key,x,y){
  const board = state.materialBoard;
  if(!board || !board.confirmed) return;
  if((board.available[key] || 0) <= 0) return;

  const menu = ensureMaterialContextMenu();
  const qty = Math.max(1,Math.min(board.batchQuantity[key] || 1,board.available[key] || 1));
  const contextCols = Math.max(1,Math.ceil(board.groups.length / 2));

  menu.innerHTML = `
    <div class="material-context-title">
      Enviar <strong>${qty}</strong> peça(s) de ${pieceLabel(key).toLowerCase()} para:
    </div>

    <div class="material-context-options" style="--context-cols:${contextCols}">
      ${board.groups.map((group,index) => `
        <button type="button"
                data-context-send="${key}"
                data-context-group="${index}"
                data-context-qty="${qty}">
          Grupo ${index+1}
        </button>
      `).join("")}
    </div>
  `;

  menu.style.left = `${Math.max(8,Math.min(x,window.innerWidth - Math.min(920,window.innerWidth * .92)))}px`;
  menu.style.top = `${Math.max(8,Math.min(y,window.innerHeight - 330))}px`;
  menu.classList.remove("hidden");

  menu.querySelectorAll("[data-context-send]").forEach(button => {
    button.addEventListener("click",event => {
      event.stopPropagation();
      moveMaterialPieceToGroup(
        button.dataset.contextSend,
        Number(button.dataset.contextGroup),
        Number(button.dataset.contextQty)
      );
      menu.classList.add("hidden");
    });
  });
}

/* ============================================================
   RASCUNHO — crescimento automático
   ============================================================ */
function autoGrowScratchField(){
  const field = $("#studentScratch");
  if(!field) return;

  field.style.height = "auto";
  field.style.height = `${Math.max(190,field.scrollHeight + 4)}px`;
}

function setupProtectedScratchField(){
  const field = $("#studentScratch");
  if(!field) return;

  if(field.dataset.protectionBound !== "1"){
    field.dataset.protectionBound = "1";

    field.addEventListener("keydown",event => {
      const key = String(event.key || "").toLowerCase();

      if((event.ctrlKey || event.metaKey) && ["c","v","x"].includes(key)){
        blockScratchAction(event);
      }
    });

    ["copy","paste","cut","contextmenu","drop","dragstart"].forEach(eventName => {
      field.addEventListener(eventName,event => blockScratchAction(event));
    });

    field.addEventListener("dragover",event => {
      event.preventDefault();
      if(event.dataTransfer) event.dataTransfer.dropEffect = "none";
    });

    field.addEventListener("beforeinput",event => {
      if(["insertFromPaste","insertFromDrop","deleteByCut"].includes(event.inputType)){
        blockScratchAction(event);
      }
    });

    field.addEventListener("input",autoGrowScratchField);
  }

  autoGrowScratchField();
}

function renderStudentAnswerArea(submission){
  const area = $("#studentAnswerArea");

  area.innerHTML = `
    <div class="answer-actions">
      <label>
        Resposta final
        <input id="studentFinalAnswer" type="text" placeholder="Digite sua resposta">
      </label>

      <button id="submitStudentAnswerBtn" class="btn btn-primary" type="button">
        ENVIAR RESPOSTA
      </button>
    </div>
  `;

  $("#studentFinalAnswer").value = submission.finalAnswer || "";
  $("#submitStudentAnswerBtn").addEventListener("click",submitStudentAnswer);
  autoGrowScratchField();
}

/* Salva também o estado do Material Dourado ao salvar o exercício. */
function saveCurrentProgress(){
  if(!state.student || !state.currentActivity) return;

  const data = loadData();
  const submission = data.submissions.find(s =>
    s.studentId === state.student.id &&
    s.activityId === state.currentActivity.id
  );

  if(!submission) return;

  submission.activeSeconds = state.activeSeconds;
  submission.scratch = $("#studentScratch")?.value || submission.scratch || "";
  submission.finalAnswer = $("#studentFinalAnswer")?.value || submission.finalAnswer || "";
  submission.updatedAt = new Date().toISOString();

  if(state.materialBoard){
    submission.materialProgress = {
      board:serializeMaterialBoard(state.materialBoard),
      savedAt:new Date().toISOString(),
      reason:"salvamento do exercício"
    };
  }

  const student = data.students.find(s => s.id === state.student.id);
  if(student) student.lastAccess = new Date().toISOString();

  saveData(data);
}

/* Ligações dos novos controles globais. */
document.addEventListener("DOMContentLoaded",() => {
  $("#materialExitWithoutSaveBtn")?.addEventListener("click",materialExitWithoutSave);
  $("#materialExitSaveBtn")?.addEventListener("click",materialExitWithSave);
  $("#materialExitCancelBtn")?.addEventListener("click",() => {
    $("#materialExitModal")?.classList.add("hidden");
  });

  // O botão Voltar ao exercício do cabeçalho do laboratório também salva.
  const backButton = $("#backFromMaterialBtn");
  if(backButton){
    backButton.replaceWith(backButton.cloneNode(true));
    $("#backFromMaterialBtn")?.addEventListener("click",closeMaterialLab);
  }
});