/* ============================================================
   PROJETO EDUCACIONAL 7.0
   Compatível com o SQL 6.1 já executado no Supabase.
   ============================================================ */

const SUPABASE_URL = "https://qtqojkvmztsglmniqkgt.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_gS10P9sP6dMYKH9iXublgQ_V5mamrpI";
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const state = {
  session:null, role:null, professor:null, student:null, currentClass:null,
  classes:[], areas:[], components:[], modules:[], levels:[], activityTypes:[], transversalThemes:[],
  currentContext:null, currentActivity:null, currentClassActivity:null, currentDraft:{},
  activeSeconds:0, timerHandle:null, timerHeartbeat:null, lastTick:null, lastInteraction:Date.now(),
  reportRows:[], reportStudents:[], reportSubmissions:[], realtimeChannel:null
};

const screens = ["screenLanding","screenProfessorAuth","screenStudentAuth","screenProfessorHome","screenWorkspace","screenProfessorProfile","screenStudentDashboard","screenStudentActivity"];
const $ = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>[...r.querySelectorAll(s)];

const STREAMING_ROWS = [
  {title:"Matemática",items:[
    {title:"Adição",image:"./adicao.jpg",subtitle:"Laboratório de Adição",area:"matematica",component:"matematica",module:"adicao",mode:"module"},
    {title:"Subtração",image:"./subtracao.jpg",subtitle:"Laboratório de Subtração",area:"matematica",component:"matematica",module:"subtracao",mode:"module"},
    {title:"Multiplicação",image:"./multiplicacao.jpg",subtitle:"Laboratório de Multiplicação",area:"matematica",component:"matematica",module:"multiplicacao",mode:"module"},
    {title:"Divisão",image:"./divisao.jpg",subtitle:"Laboratório da Divisão",area:"matematica",component:"matematica",module:"divisao",mode:"module"},
    {title:"Educação Financeira",image:"./educacao-financeira.jpg",subtitle:"Situações financeiras e porcentagem",area:"matematica",component:"matematica",module:"educacao-financeira",mode:"module"}
  ]},
  {title:"Áreas do Conhecimento",items:[
    {title:"Linguagens",image:"./linguagens.jpg",subtitle:"Português, Literatura, Arte e Inglês",area:"linguagens",mode:"area"},
    {title:"Ciências Humanas",image:"./ciencias-humanas.jpg",subtitle:"Filosofia, História, Geografia e Sociologia",area:"ciencias-humanas",mode:"area"},
    {title:"Ciências da Natureza",image:"./ciencias-natureza.jpg",subtitle:"Biologia, Física e Química",area:"ciencias-da-natureza",mode:"area"},
    {title:"Temas Transversais",image:"./temas-transversais.jpg",subtitle:"Integrações entre áreas e componentes",mode:"transversal"}
  ]},
  {title:"Educação, Tecnologia e Projeto Pessoal",items:[
    {title:"Educação Digital / Computação",image:"./educacao-digital.jpg",subtitle:"Pensamento computacional, lógica e programação",area:"educacao-digital-computacao",mode:"area"},
    {title:"Projeto de Vida",image:"./projeto-de-vida.jpg",subtitle:"Autoconhecimento, planejamento e mundo do trabalho",area:"projeto-de-vida",mode:"area"}
  ]}
];

function showScreen(id){screens.forEach(x=>document.getElementById(x)?.classList.toggle("active",x===id));window.scrollTo({top:0,behavior:"smooth"});}
function setTopbar(show,role=null){$("#topbar").classList.toggle("hidden",!show);$("#professorNav").classList.toggle("hidden",role!=="professor");$("#studentNav").classList.toggle("hidden",role!=="student");}
function toast(message,type="info",timeout=3800){const el=$("#toast");el.textContent=message;el.className=`toast ${type}`;clearTimeout(toast._t);toast._t=setTimeout(()=>el.classList.add("hidden"),timeout);}
function esc(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");}
function normalizeClassCode(v){return String(v??"").trim().toUpperCase().replace(/\s+/g,"-").replace(/[^A-Z0-9_-]/g,"");}
function parseStudentName(v){const raw=String(v??"").trim();const m=raw.match(/^(\d{2})\s*\.\s*(.+)$/u);if(!m)return{valid:false,message:"O nome do aluno deve começar com dois algarismos, ponto e nome. Ex.: 03. André Paulo."};const roster=Number(m[1]),plainName=m[2].replace(/\s+/g," ").trim();if(!plainName||plainName.length<2)return{valid:false,message:"Informe o nome do aluno após o número da chamada."};return{valid:true,roster,rosterText:String(roster).padStart(2,"0"),plainName,fullName:`${String(roster).padStart(2,"0")}. ${plainName}`};}
function studentPlainName(name){const p=parseStudentName(name);return p.valid?p.plainName:String(name??"");}
function formatDateTime(v){if(!v)return"—";try{return new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short"}).format(new Date(v));}catch{return"—";}}
function formatDuration(sec){sec=Math.max(0,Math.floor(Number(sec)||0));const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60;return h?`${h}h ${String(m).padStart(2,"0")}min ${String(s).padStart(2,"0")}s`:`${m}min ${String(s).padStart(2,"0")}s`;}
function timerText(sec){sec=Math.max(0,Math.floor(Number(sec)||0));const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60;return h?`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`:`${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;}
function b64Url(v){const bytes=new TextEncoder().encode(String(v));let bin="";bytes.forEach(b=>bin+=String.fromCharCode(b));return btoa(bin).replaceAll("+","-").replaceAll("/","_").replaceAll("=","");}
/*
  AUTENTICAÇÃO INTERNA 7.0
  -----------------------
  O usuário continua vendo somente USUÁRIO + SENHA.
  O Supabase Auth exige um endereço de e-mail tecnicamente válido.

  Para evitar o erro de domínios reservados ou sem DNS, novas contas usam
  um identificador interno determinístico terminado em @gmail.com.
  Como "Confirm Email" está DESATIVADO, nenhum e-mail de confirmação é enviado.

  Os dois formatos anteriores permanecem SOMENTE como fallback de login
  para tentativas antigas de cadastro.
*/
function fnv1a64Token(value){
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const normalized = String(value ?? "").trim().toLowerCase();
  const bytes = new TextEncoder().encode(normalized);

  for(const byte of bytes){
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * prime);
  }

  return hash.toString(16).padStart(16,"0");
}

const AUTH_INTERNAL_DOMAIN = "gmail.com";
const AUTH_PREVIOUS_DOMAIN = "projetoeducacional.app";
const AUTH_LEGACY_DOMAIN = "labdiv.example";

function professorEmail(username){
  return `pe7p.${fnv1a64Token(username)}@${AUTH_INTERNAL_DOMAIN}`;
}

function professorPreviousEmail(username){
  return `p.${b64Url(String(username).trim())}@${AUTH_PREVIOUS_DOMAIN}`;
}

function professorLegacyEmail(username){
  return `p.${b64Url(String(username).trim())}@${AUTH_LEGACY_DOMAIN}`;
}

function studentEmail(classCode, rosterText){
  return `pe7a.${fnv1a64Token(normalizeClassCode(classCode))}.${String(rosterText).padStart(2,"0")}@${AUTH_INTERNAL_DOMAIN}`;
}

function studentPreviousEmail(classCode, rosterText){
  return `a.${b64Url(normalizeClassCode(classCode))}.${b64Url(rosterText)}@${AUTH_PREVIOUS_DOMAIN}`;
}

function studentLegacyEmail(classCode, rosterText){
  return `a.${b64Url(normalizeClassCode(classCode))}.${b64Url(rosterText)}@${AUTH_LEGACY_DOMAIN}`;
}

function makeRandomClassCode(){const c="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";let out="T-";for(let i=0;i<6;i++)out+=c[Math.floor(Math.random()*c.length)];return out;}
function getActiveSecondsFromDraft(d){return Number(d?._tracking?.activeSeconds||0);}
function debounce(fn,ms){let t;return(...args)=>{clearTimeout(t);t=setTimeout(()=>fn(...args),ms);};}
function operationFromModuleSlug(slug){return({adicao:"addition",subtracao:"subtraction",multiplicacao:"multiplication",divisao:"division"})[slug]||null;}
function findArea(slug){return state.areas.find(x=>x.slug===slug)||null;} function findComponent(slug,areaId=null){return state.components.find(x=>x.slug===slug&&(!areaId||x.area_id===areaId))||null;} function findModule(slug,componentId=null){return state.modules.find(x=>x.slug===slug&&(!componentId||x.component_id===componentId))||null;}


/* ============================================================
   CONEXÃO RESILIENTE COM O SUPABASE - V7.0
   ------------------------------------------------------------
   O CodePen roda dentro de um ambiente de preview. Em alguns
   navegadores o supabase-js pode retornar apenas "Failed to fetch"
   antes mesmo de o RPC responder.

   Para os RPCs críticos de cadastro, tentamos primeiro a REST API
   do Supabase diretamente, usando APENAS a publishable key no modo
   anônimo. Depois do login, usamos o access_token da sessão.
   ============================================================ */

async function fetchWithTimeout(url, options = {}, timeoutMs = 15000){
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try{
    return await fetch(url, {
      ...options,
      mode: "cors",
      cache: "no-store",
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

async function directSupabaseRpc(functionName, args = {}, accessToken = null){
  const headers = {
    "apikey": SUPABASE_PUBLISHABLE_KEY,
    "Content-Type": "application/json",
    "Accept": "application/json"
  };

  /*
    IMPORTANTE:
    - Antes do login: NÃO colocamos a publishable key em Authorization.
    - Depois do login: Authorization recebe o JWT real do usuário.
  */
  if(accessToken){
    headers.Authorization = `Bearer ${accessToken}`;
  }

  let response;

  try{
    response = await fetchWithTimeout(
      `${SUPABASE_URL}/rest/v1/rpc/${functionName}`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(args)
      },
      15000
    );
  }catch(error){
    const origin = window.location.origin;
    const ambienteCodePen = /codepen|cdpn/i.test(
      `${window.location.hostname} ${document.referrer}`
    );

    throw new Error(
      `Não foi possível alcançar o Supabase pela REST API. ` +
      `Origem atual: ${origin}. ` +
      (ambienteCodePen
        ? `O teste está rodando no preview do CodePen. `
        : ``) +
      `Erro de rede: ${error?.message || error}`
    );
  }

  const raw = await response.text();
  let data = null;

  if(raw){
    try{
      data = JSON.parse(raw);
    }catch{
      data = raw;
    }
  }

  if(!response.ok){
    const message =
      data?.message ||
      data?.error_description ||
      data?.hint ||
      (typeof data === "string" ? data : "") ||
      `HTTP ${response.status}`;

    throw new Error(
      `${functionName}: ${message} (HTTP ${response.status})`
    );
  }

  return data;
}

async function resilientRpc(functionName, args = {}, accessToken = null){
  /* 1º: REST direta, com cabeçalhos mínimos. */
  try{
    return await directSupabaseRpc(
      functionName,
      args,
      accessToken
    );
  }catch(directError){
    console.warn(
      `REST direta falhou em ${functionName}:`,
      directError
    );

    /* 2º: SDK como fallback. */
    try{
      const {data,error} = await sb.rpc(
        functionName,
        args
      );

      if(error) throw error;
      return data;
    }catch(sdkError){
      console.error(
        `SDK também falhou em ${functionName}:`,
        sdkError
      );

      throw new Error(
        `${directError.message} | Fallback SDK: ${sdkError?.message || sdkError}`
      );
    }
  }
}

async function testSupabaseConnection(){
  const tests = [];

  try{
    const response = await fetchWithTimeout(
      `${SUPABASE_URL}/rest/v1/`,
      {
        method: "GET",
        headers: {
          "apikey": SUPABASE_PUBLISHABLE_KEY,
          "Accept": "application/json"
        }
      },
      10000
    );

    tests.push({
      name: "REST",
      ok: response.status >= 200 && response.status < 500,
      status: response.status
    });
  }catch(error){
    tests.push({
      name: "REST",
      ok: false,
      error: error?.message || String(error)
    });
  }

  return tests;
}

/* ---------- AUTENTICAÇÃO ---------- */
async function initSession(){const{data}=await sb.auth.getSession();state.session=data.session||null;if(!state.session){state.role=null;setTopbar(false);showScreen("screenLanding");return;}await routeAuthenticatedUser();}
async function routeAuthenticatedUser(){const user=state.session?.user;if(!user)return showScreen("screenLanding");
  const{data:prof}=await sb.from("professors").select("*").eq("id",user.id).maybeSingle();
  if(prof){state.role="professor";state.professor=prof;$("#topbarUserName").textContent=prof.name;setTopbar(true,"professor");await loadReferenceData();await loadClasses();const{data:settings,error}=await sb.rpc("get_my_security_settings");if(error){toast(error.message,"error");return showProfessorHome();}const row=Array.isArray(settings)?settings[0]:settings;if(row?.require_admin_key){$("#adminGateKey").value="";$("#adminGateModal").classList.remove("hidden");return;}return showProfessorHome();}
  const{data:student}=await sb.from("students").select("*, classes(*)").eq("id",user.id).maybeSingle();
  if(student){state.role="student";state.student=student;state.currentClass=student.classes||null;$("#topbarUserName").textContent=student.name;setTopbar(true,"student");return showStudentDashboard();}
  toast("Perfil não encontrado para esta conta.","error");await logout();
}
async function logout(){stopActivityTimer(true);if(state.realtimeChannel){await sb.removeChannel(state.realtimeChannel);state.realtimeChannel=null;}await sb.auth.signOut();Object.assign(state,{session:null,role:null,professor:null,student:null,currentClass:null,classes:[],currentContext:null,currentActivity:null,currentClassActivity:null,currentDraft:{},reportRows:[],reportStudents:[],reportSubmissions:[]});setTopbar(false);showScreen("screenLanding");}
async function professorLogin(e){
  e.preventDefault();

  const username=$("#profLoginUsername").value.trim();
  const password=$("#profLoginPassword").value;

  const candidateEmails=[
    professorEmail(username),
    professorPreviousEmail(username),
    professorLegacyEmail(username)
  ];

  let result=null;

  for(const email of candidateEmails){
    const attempt=await sb.auth.signInWithPassword({email,password});

    if(!attempt.error){
      result=attempt;
      break;
    }

    result=attempt;
  }

  if(result?.error){
    console.error("Erro de login do professor:", result.error);
    return toast(
      `Não foi possível entrar (${result.error.code||"auth"}). Verifique usuário e senha.`,
      "error",
      7000
    );
  }

  state.session=result.data.session;
  await routeAuthenticatedUser();
}

async function professorRegister(e){
  e.preventDefault();

  const form = e.currentTarget;
  const submitButton = form.querySelector('button[type="submit"]');

  const name = $("#profRegisterName").value.trim();
  const username = $("#profRegisterUsername").value.trim();
  const password = $("#profRegisterPassword").value;
  const password2 = $("#profRegisterPassword2").value;
  const masterKey = $("#profRegisterMasterKey").value.trim();

  if(name.length < 2)
    return toast("Informe o nome do professor.","error");

  if(username.length < 2)
    return toast("Informe um usuário com pelo menos 2 caracteres.","error");

  if(password.length < 8)
    return toast("A senha precisa ter pelo menos 8 caracteres.","error");

  if(password !== password2)
    return toast("As senhas não coincidem.","error");

  if(!masterKey)
    return toast("Informe a chave geral para criar o perfil de professor.","error");

  const originalText = submitButton.textContent;
  submitButton.disabled = true;
  submitButton.textContent = "CONECTANDO...";

  let etapa = "teste de conexão";

  try{
    /* --------------------------------------------------------
       1. TESTE DA CONEXÃO
       -------------------------------------------------------- */
    const connection = await testSupabaseConnection();
    const restTest = connection.find(item => item.name === "REST");

    if(!restTest?.ok){
      throw new Error(
        `O navegador não conseguiu alcançar a API do Supabase. ` +
        `${restTest?.error || "REST indisponível"}. ` +
        `Se estiver no CodePen, teste também no modo Full Page/Debug ` +
        `ou no GitHub Pages.`
      );
    }

    /* --------------------------------------------------------
       2. VALIDAR CHAVE GERAL
       REST DIRETA PRIMEIRO; SDK SOMENTE COMO FALLBACK.
       -------------------------------------------------------- */
    etapa = "validação da chave geral";
    submitButton.textContent = "VALIDANDO CHAVE...";

    const keyOk = await resilientRpc(
      "verify_teacher_access",
      { p_key: masterKey },
      null
    );

    if(keyOk !== true){
      throw new Error(
        "Chave geral inválida. Confira a chave de cadastro do professor."
      );
    }

    /* --------------------------------------------------------
       3. CRIAR / RECUPERAR AUTENTICAÇÃO
       -------------------------------------------------------- */
    etapa = "criação da autenticação";
    submitButton.textContent = "CRIANDO ACESSO...";

    const email = professorEmail(username);
    let authData = null;

    let signUpResult;

    try{
      signUpResult = await sb.auth.signUp({
        email,
        password,
        options:{
          data:{
            app_role:"professor",
            app_username:username
          }
        }
      });
    }catch(fetchError){
      throw new Error(
        `O Supabase Auth não respondeu: ${fetchError?.message || fetchError}`
      );
    }

    const signUpData = signUpResult.data;
    const signUpError = signUpResult.error;

    if(signUpError){
      console.error(
        "Erro Supabase Auth ao criar professor:",
        signUpError
      );

      const duplicateCodes = [
        "user_already_exists",
        "email_exists"
      ];

      const duplicateMessage =
        String(signUpError.message || "")
          .toLowerCase()
          .includes("already");

      if(
        duplicateCodes.includes(signUpError.code) ||
        duplicateMessage
      ){
        const loginResult = await sb.auth.signInWithPassword({
          email,
          password
        });

        if(loginResult.error){
          throw new Error(
            "Este usuário já possui uma conta. Use a senha cadastrada anteriormente ou escolha outro usuário."
          );
        }

        authData = loginResult.data;
      }else{
        throw new Error(
          `${signUpError.message} [${signUpError.code || "auth"}]`
        );
      }
    }else if(!signUpData?.session){
      const loginResult = await sb.auth.signInWithPassword({
        email,
        password
      });

      if(loginResult.error){
        throw new Error(
          "A conta foi criada, mas a sessão não iniciou. Confirme no Supabase se Confirm Email continua desativado."
        );
      }

      authData = loginResult.data;
    }else{
      authData = signUpData;
    }

    if(!authData?.session?.user?.id){
      throw new Error(
        "O Supabase Auth não devolveu uma sessão válida."
      );
    }

    state.session = authData.session;

    /* Garante que o SDK reconheça explicitamente a sessão obtida. */
    if(
      authData.session.access_token &&
      authData.session.refresh_token
    ){
      const setResult = await sb.auth.setSession({
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token
      });

      if(!setResult.error && setResult.data?.session){
        state.session = setResult.data.session;
      }
    }

    /* --------------------------------------------------------
       4. VERIFICAR SE O PERFIL JÁ EXISTE
       -------------------------------------------------------- */
    etapa = "verificação do perfil";
    submitButton.textContent = "VERIFICANDO PERFIL...";

    const profileCheck = await sb
      .from("professors")
      .select("*")
      .eq("id", state.session.user.id)
      .maybeSingle();

    if(profileCheck.error){
      console.warn(
        "Não foi possível consultar o perfil pelo SDK:",
        profileCheck.error
      );
    }

    if(profileCheck.data){
      state.professor = profileCheck.data;

      toast(
        "Este perfil já existia. Acesso realizado.",
        "success"
      );

      form.reset();
      await routeAuthenticatedUser();
      return;
    }

    /* --------------------------------------------------------
       5. CRIAR PERFIL NO BANCO
       Usa o JWT real do professor no RPC direto.
       -------------------------------------------------------- */
    etapa = "criação do perfil do professor";
    submitButton.textContent = "SALVANDO PERFIL...";

    await resilientRpc(
      "create_my_professor_profile",
      {
        p_name: name,
        p_username: username,
        p_master_key: masterKey
      },
      state.session.access_token
    );

    toast(
      "Perfil do professor criado com sucesso.",
      "success"
    );

    form.reset();
    await routeAuthenticatedUser();

  }catch(error){
    console.error(
      `Erro no cadastro do professor — etapa: ${etapa}`,
      error
    );

    const codepen = /codepen|cdpn/i.test(
      `${window.location.hostname} ${document.referrer}`
    );

    const extra =
      /failed to fetch|não foi possível alcançar|network|fetch/i.test(
        String(error?.message || error)
      )
        ? (codepen
            ? " O preview do CodePen pode estar bloqueando a chamada. O mesmo código deve ser testado também no GitHub Pages ou no modo Debug/Full Page do CodePen."
            : " Verifique a conexão do navegador e extensões que possam bloquear requisições.")
        : "";

    toast(
      `Erro na etapa "${etapa}": ${error?.message || "falha desconhecida"}.${extra}`,
      "error",
      14000
    );

  }finally{
    submitButton.disabled = false;
    submitButton.textContent = originalText;
  }
}

async function studentLogin(e){
  e.preventDefault();

  const classCode=normalizeClassCode(
    $("#studentLoginClassCode").value
  );

  const roster=String(
    $("#studentLoginRoster").value
  ).replace(/\D/g,"").padStart(2,"0");

  const password=$("#studentLoginPassword").value;

  if(!/^\d{2}$/.test(roster)){
    return toast(
      "Informe o número da chamada com dois algarismos.",
      "error"
    );
  }

  const candidateEmails=[
    studentEmail(classCode,roster),
    studentPreviousEmail(classCode,roster),
    studentLegacyEmail(classCode,roster)
  ];

  let result=null;

  for(const email of candidateEmails){
    const attempt=await sb.auth.signInWithPassword({
      email,
      password
    });

    if(!attempt.error){
      result=attempt;
      break;
    }

    result=attempt;
  }

  if(result?.error){
    console.error("Erro de login do aluno:",result.error);

    return toast(
      `Não foi possível entrar (${result.error.code||"auth"}). Confira código da turma, número da chamada e senha.`,
      "error",
      7000
    );
  }

  state.session=result.data.session;
  await routeAuthenticatedUser();
}

async function studentRegister(e){e.preventDefault();const classCode=normalizeClassCode($("#studentRegisterClassCode").value),parsed=parseStudentName($("#studentRegisterName").value),password=$("#studentRegisterPassword").value,password2=$("#studentRegisterPassword2").value;if(!parsed.valid)return toast(parsed.message,"error",5500);if(password!==password2)return toast("As senhas não coincidem.","error");let lookup;try{lookup=await resilientRpc("lookup_class_by_code",{p_code:classCode},null);}catch(error){console.error("Erro ao localizar turma:",error);return toast(`Não foi possível consultar a turma: ${error.message}`,"error",8000);}if(!Array.isArray(lookup)||!lookup.length)return toast("Código de turma não encontrado.","error");const{data,error}=await sb.auth.signUp({
    email:studentEmail(classCode,parsed.rosterText),
    password
  });
  if(error){
    console.error("Erro Supabase Auth ao criar aluno:",error);

    const duplicateCodes=["user_already_exists","email_exists"];
    const duplicateMessage=String(error.message||"").toLowerCase().includes("already");

    if(duplicateCodes.includes(error.code)||duplicateMessage){
      return toast(`O número ${parsed.rosterText} já possui acesso nesta turma.`,"error",6000);
    }

    return toast(`Falha no cadastro (${error.code||"sem código"}): ${error.message}`,"error",7000);
  }
  if(!data.session){
    return toast(
      "A conta foi criada, mas a sessão não iniciou. Confirme se 'Confirm Email' está desativado no Supabase.",
      "error",
      7000
    );
  }
  state.session=data.session;
  /* Sem mudar o SQL: username = número da chamada. A restrição unique(class_id,username) impede número repetido. */
  const{error:pErr}=await sb.rpc("create_my_student_profile",{p_name:parsed.fullName,p_username:parsed.rosterText,p_class_code:classCode});if(pErr){toast(pErr.message,"error",6000);await sb.auth.signOut();state.session=null;return;}toast("Acesso do aluno criado com sucesso.","success");await routeAuthenticatedUser();}

/* ---------- SEGURANÇA PROFESSOR ---------- */
async function submitAdminGate(e){e.preventDefault();const{data,error}=await sb.rpc("can_open_my_admin_area",{p_key:$("#adminGateKey").value});if(error)return toast(error.message,"error");if(!data)return toast("Chave pessoal inválida.","error");$("#adminGateModal").classList.add("hidden");await showProfessorHome();}
async function showProfessorProfile(){showScreen("screenProfessorProfile");const p=state.professor;$("#profileInfo").innerHTML=`<div class="profile-row"><small>Nome</small><strong>${esc(p?.name||"—")}</strong></div><div class="profile-row"><small>Usuário</small><strong>${esc(p?.username||"—")}</strong></div><div class="profile-row"><small>Perfil</small><strong>Professor</strong></div>`;const{data,error}=await sb.rpc("get_my_security_settings");if(!error){const row=Array.isArray(data)?data[0]:data;$("#requireAdminKeyToggle").checked=Boolean(row?.require_admin_key);}}
async function changeMyAccessKey(e){e.preventDefault();const{error}=await sb.rpc("change_my_access_key",{p_new_key:$("#newAccessKey").value,p_confirm_key:$("#confirmAccessKey").value});if(error)return toast(error.message,"error",6000);e.target.reset();toast("Sua chave pessoal foi alterada.","success");}
async function setAdminKeyRequired(){const required=$("#requireAdminKeyToggle").checked;const{error}=await sb.rpc("set_my_admin_key_required",{p_required:required});if(error){$("#requireAdminKeyToggle").checked=!required;return toast(error.message,"error");}toast(required?"A chave pessoal será exigida na entrada administrativa.":"A chave pessoal não será exigida na entrada administrativa.","success");}

/* ---------- DADOS DE REFERÊNCIA ---------- */
async function loadReferenceData(){const[a,c,m,l,t,tr]=await Promise.all([sb.from("areas").select("*").eq("is_active",true).order("sort_order"),sb.from("components").select("*").eq("is_active",true).order("sort_order"),sb.from("modules").select("*").eq("is_active",true).order("sort_order"),sb.from("education_levels").select("*").eq("is_active",true).order("sort_order"),sb.from("activity_types").select("*").eq("is_active",true).order("name"),sb.from("transversal_themes").select("*").eq("is_active",true).order("name")]);state.areas=a.data||[];state.components=c.data||[];state.modules=m.data||[];state.levels=l.data||[];state.activityTypes=t.data||[];state.transversalThemes=tr.data||[];}

/* ---------- STREAMING ---------- */
async function showProfessorHome(){if(!state.professor)return;$("#professorWelcome").textContent=`Olá, ${state.professor.name}.`;renderStreamingRows();setTopbar(true,"professor");showScreen("screenProfessorHome");}
function renderStreamingRows(){const c=$("#streamingRows");c.innerHTML="";STREAMING_ROWS.forEach(row=>{const sec=document.createElement("section");sec.className="stream-row";sec.innerHTML=`<div class="stream-row-heading"><h2>${esc(row.title)}</h2></div><div class="cover-grid"></div>`;const grid=$(".cover-grid",sec);row.items.forEach(item=>{const b=document.createElement("button");b.className="cover-card";b.type="button";b.innerHTML=`<img src="${esc(item.image)}" alt="${esc(item.title)}"><div class="cover-overlay"><strong>${esc(item.title)}</strong><small>${esc(item.subtitle||"")}</small></div>`;const img=$("img",b);img.addEventListener("error",()=>{img.style.display="none";b.style.background="radial-gradient(circle at 20% 20%,rgba(44,168,255,.24),transparent 35%),linear-gradient(135deg,#17314b,#07111f)";});b.addEventListener("click",()=>openWorkspace(item));grid.appendChild(b);});c.appendChild(sec);});}
async function openWorkspace(context){state.currentContext={...context};$("#workspaceTitle").textContent=context.title;$("#workspaceEyebrow").textContent=context.mode==="transversal"?"TEMAS TRANSVERSAIS":"ÁREA DE TRABALHO";$("#workspaceSubtitle").textContent=context.subtitle||"";setWorkspaceTab("overview");showScreen("screenWorkspace");await Promise.all([loadClasses(),prepareActivityForm(),loadActivities()]);}
function setWorkspaceTab(tab){$$('.workspace-tab').forEach(b=>b.classList.toggle('active',b.dataset.workTab===tab));$$('.workspace-panel').forEach(p=>p.classList.remove('active'));const map={overview:'#workOverview',classes:'#workClasses',activities:'#workActivities',upload:'#workUpload',reports:'#workReports'};$(map[tab])?.classList.add('active');if(tab==='classes')loadClasses();if(tab==='activities')loadActivities();if(tab==='upload')prepareActivityForm();if(tab==='reports')prepareReports();}

/* ---------- TURMAS ---------- */
async function loadClasses(){if(!state.professor)return;const{data,error}=await sb.from("classes").select(`*,class_levels(level_id,education_levels(id,code,name,sort_order))`).eq("professor_id",state.professor.id).order("name");if(error)return toast(error.message,"error");state.classes=data||[];renderClassList();populateClassSelects();}
function renderClassList(){const list=$("#classList");if(!list)return;if(!state.classes.length){list.innerHTML='<div class="list-card"><p>Nenhuma turma cadastrada.</p></div>';return;}list.innerHTML=state.classes.map(x=>{const levels=(x.class_levels||[]).map(y=>y.education_levels?.code).filter(Boolean).sort().join(', ');return`<article class="list-card"><div class="list-card-top"><div><h3>${esc(x.name)}</h3><p>${esc(x.grade||'Etapa não informada')} • ${esc(x.school_year||'—')}</p></div><span class="badge">${esc(x.code)}</span></div><div class="badge-row"><span class="badge">Níveis: ${esc(levels||'nenhum')}</span></div><div class="card-actions"><button class="btn btn-small btn-outline" type="button" data-edit-class="${x.id}">EDITAR TURMA</button></div></article>`;}).join('');$$('[data-edit-class]',list).forEach(b=>b.addEventListener('click',()=>editClass(b.dataset.editClass)));}
function populateClassSelects(){[$("#activityAssignClass"),$("#uploadAssignClass"),$("#reportClassSelect")].filter(Boolean).forEach(select=>{const current=select.value;let html=select.id==='reportClassSelect'?'<option value="">Selecione uma turma</option>':`<option value="">${select.id==='uploadAssignClass'?'Somente banco do professor':'Não liberar agora'}</option>`;html+=state.classes.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('');select.innerHTML=html;if(current&&state.classes.some(x=>x.id===current))select.value=current;});}
async function saveClass(e){e.preventDefault();const editId=$("#classEditId").value,name=$("#className").value.trim(),grade=$("#classGrade").value.trim(),school_year=Number($("#classYear").value)||null,code=normalizeClassCode($("#classCode").value),description=$("#classDescription").value.trim(),levelCodes=$$('input[name="classLevel"]:checked').map(i=>i.value);if(!levelCodes.length)return toast("Selecione pelo menos um nível.","error");let classId=editId||null;if(editId){const{error}=await sb.from('classes').update({name,grade:grade||null,school_year,code,description:description||null}).eq('id',editId);if(error)return toast(error.message,'error',6000);}else{const{data,error}=await sb.from('classes').insert({professor_id:state.professor.id,name,grade:grade||null,school_year,code,description:description||null}).select('id').single();if(error)return toast(error.message,'error',6000);classId=data.id;}const selected=state.levels.filter(l=>levelCodes.includes(l.code));const{error:dErr}=await sb.from('class_levels').delete().eq('class_id',classId);if(dErr)return toast(dErr.message,'error');const{error:lErr}=await sb.from('class_levels').insert(selected.map(l=>({class_id:classId,level_id:l.id})));if(lErr)return toast(lErr.message,'error');resetClassForm();await loadClasses();toast(editId?'Turma atualizada.':'Turma cadastrada.','success');}
function editClass(id){const x=state.classes.find(c=>c.id===id);if(!x)return;$("#classEditId").value=x.id;$("#className").value=x.name||'';$("#classGrade").value=x.grade||'';$("#classYear").value=x.school_year||'';$("#classCode").value=x.code||'';$("#classDescription").value=x.description||'';const codes=(x.class_levels||[]).map(y=>y.education_levels?.code).filter(Boolean);$$('input[name="classLevel"]').forEach(i=>i.checked=codes.includes(i.value));$("#classFormTitle").textContent='Editar turma';$("#cancelClassEditBtn").classList.remove('hidden');setWorkspaceTab('classes');}
function resetClassForm(){$("#classForm").reset();$("#classEditId").value='';$("#classFormTitle").textContent='Cadastrar turma';$("#cancelClassEditBtn").classList.add('hidden');$("#classYear").value=new Date().getFullYear();$("#classCode").value=makeRandomClassCode();}

/* ---------- FORMULÁRIO ATIVIDADES ---------- */
async function prepareActivityForm(){if(!state.currentContext)return;if(!state.areas.length)await loadReferenceData();const ctx=state.currentContext,area=ctx.area?findArea(ctx.area):null;let comps=area?state.components.filter(x=>x.area_id===area.id):state.components;if(ctx.component&&area)comps=comps.filter(x=>x.slug===ctx.component);$("#activityComponent").innerHTML='<option value="">Selecione</option>'+comps.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('');if(ctx.component&&area){const c=findComponent(ctx.component,area.id);if(c)$("#activityComponent").value=c.id;}fillModulesForSelectedComponent();if(ctx.module&&$("#activityComponent").value){const m=findModule(ctx.module,$("#activityComponent").value);if(m)$("#activityModule").value=m.id;}$("#activityLevel").innerHTML='<option value="">Sem nível específico</option>'+state.levels.map(x=>`<option value="${x.id}">${esc(x.name)} — ${esc(x.description||'')}</option>`).join('');$("#activityType").innerHTML=state.activityTypes.map(x=>`<option value="${x.id}" data-code="${esc(x.code)}">${esc(x.name)}</option>`).join('');const preferred=state.activityTypes.find(t=>ctx.mode==='module'&&['adicao','subtracao','multiplicacao','divisao'].includes(ctx.module)?t.code==='interactive':t.code==='problem_situation');if(preferred)$("#activityType").value=preferred.id;$("#activityTransversalTheme").innerHTML='<option value="">Nenhum</option>'+state.transversalThemes.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('');$("#activityContextSummary").innerHTML=`<strong>${esc(ctx.title)}</strong><br><span>${ctx.mode==='transversal'?'Escolha uma área/componente e um tema transversal.':'A atividade será vinculada ao contexto desta capa.'}</span>`;updateMathFieldsVisibility();populateClassSelects();}
function fillModulesForSelectedComponent(){const componentId=$("#activityComponent").value,ctx=state.currentContext;let mods=state.modules.filter(x=>x.component_id===componentId);if(ctx?.module&&ctx?.component)mods=mods.filter(x=>x.slug===ctx.module);$("#activityModule").innerHTML='<option value="">Sem módulo específico</option>'+mods.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('');updateMathFieldsVisibility();}
function updateMathFieldsVisibility(){const m=state.modules.find(x=>x.id===$("#activityModule").value);$("#mathFields").classList.toggle('hidden',!(m&&['adicao','subtracao','multiplicacao','divisao','educacao-financeira'].includes(m.slug)));}
async function createActivity(e){e.preventDefault();const ctx=state.currentContext,area=ctx?.area?findArea(ctx.area):null;let areaId=area?.id||null,componentId=$("#activityComponent").value||null,moduleId=$("#activityModule").value||null;if(!areaId&&componentId)areaId=state.components.find(x=>x.id===componentId)?.area_id||null;if(!areaId)return toast('Selecione um componente associado a uma área.','error');const levelId=$("#activityLevel").value||null,typeId=$("#activityType").value,mode=$("#activityCorrectionMode").value,title=$("#activityTitle").value.trim(),statement=$("#activityStatement").value.trim(),question=$("#activityQuestion").value.trim(),answer=$("#activityAnswer").value.trim(),a=$("#activityOperandA").value,b=$("#activityOperandB").value,unit=$("#activityUnit").value.trim(),mod=state.modules.find(x=>x.id===moduleId),op=operationFromModuleSlug(mod?.slug),content={};if(op){content.operation=op;content.material_dourado=true;content.unit=unit||'';if(op==='division'){content.dividend=Number(a);content.divisor=Number(b);content.exact_division=true;}else{content.operand_a=Number(a);content.operand_b=Number(b);}}if(mod?.slug==='educacao-financeira'){content.context='financial_education';if(a!=='')content.operand_a=Number(a);if(b!=='')content.operand_b=Number(b);content.unit=unit||'BRL';}let answerKey={};if(answer){const n=Number(answer.replace(',','.'));answerKey=Number.isNaN(n)?{type:'text',accepted:[answer],case_sensitive:false}:{type:'number',value:n,tolerance:0};}const{data,error}=await sb.from('activities').insert({source_type:'professor',created_by:state.professor.id,area_id:areaId,component_id:componentId,module_id:moduleId,level_id:levelId,activity_type_id:typeId,title,statement,question:question||null,correction_mode:mode,content,answer_key:answerKey,metadata:{project_version:'7.0'}}).select('id').single();if(error)return toast(error.message,'error',6000);const themeId=$("#activityTransversalTheme").value;if(themeId)await sb.from('activity_transversal_themes').insert({activity_id:data.id,transversal_theme_id:themeId});const classId=$("#activityAssignClass").value;if(classId)await assignActivityToClass(data.id,classId,false);$("#activityForm").reset();await prepareActivityForm();toast('Atividade cadastrada.','success');await loadActivities();}

/* ---------- BANCO DE ATIVIDADES ---------- */
async function loadActivities(){if(!state.professor||!state.currentContext)return;const{data,error}=await sb.from('activities').select(`id,source_type,created_by,area_id,component_id,module_id,level_id,activity_type_id,title,statement,question,correction_mode,content,metadata,is_active,areas(id,name,slug),components(id,name,slug),modules(id,name,slug),education_levels(id,code,name),activity_types(id,code,name),activity_transversal_themes(transversal_theme_id,transversal_themes(id,name,slug))`).eq('is_active',true).order('created_at',{ascending:false});if(error)return toast(error.message,'error');renderActivityList(filterActivitiesForContext(data||[]));}
function filterActivitiesForContext(items){const c=state.currentContext;if(!c)return items;if(c.mode==='transversal')return items.filter(x=>x.activity_transversal_themes?.length);return items.filter(x=>(!c.area||x.areas?.slug===c.area)&&(!c.component||x.components?.slug===c.component)&&(!c.module||x.modules?.slug===c.module));}
function renderActivityList(items){const list=$("#activityList");if(!items.length){list.innerHTML='<article class="activity-card"><p>Nenhuma atividade encontrada neste contexto.</p></article>';return;}list.innerHTML=items.map(x=>{const themes=(x.activity_transversal_themes||[]).map(y=>y.transversal_themes?.name).filter(Boolean);return`<article class="activity-card"><div class="activity-card-top"><div><h3>${esc(x.title)}</h3><p>${esc(x.statement)}</p></div><span class="badge">${x.source_type==='system'?'Sistema':'Professor'}</span></div><div class="badge-row"><span class="badge">${esc(x.areas?.name||'—')}</span>${x.components?.name?`<span class="badge">${esc(x.components.name)}</span>`:''}${x.modules?.name?`<span class="badge">${esc(x.modules.name)}</span>`:''}${x.education_levels?.code?`<span class="badge">${esc(x.education_levels.code)}</span>`:''}${themes.map(t=>`<span class="badge">${esc(t)}</span>`).join('')}</div><div class="assignment-row"><select data-assign-select="${x.id}"><option value="">Escolha a turma</option>${state.classes.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select><button class="btn btn-small btn-primary" type="button" data-assign-activity="${x.id}">LIBERAR</button></div></article>`;}).join('');$$('[data-assign-activity]',list).forEach(b=>b.addEventListener('click',async()=>{const id=b.dataset.assignActivity,classId=$(`[data-assign-select="${id}"]`,list).value;if(!classId)return toast('Escolha uma turma.','error');await assignActivityToClass(id,classId);}));}
async function assignActivityToClass(activityId,classId,notify=true){const{error}=await sb.from('class_activities').upsert({class_id:classId,activity_id:activityId,assigned_by:state.professor.id,is_active:true},{onConflict:'class_id,activity_id'});if(error){toast(error.message,'error',6000);return false;}if(notify)toast('Atividade liberada para a turma.','success');return true;}

/* ---------- UPLOAD ---------- */
function normalizeHeaderKey(v){return String(v??'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,'_');}
function rowValue(row,...keys){const n={};Object.entries(row||{}).forEach(([k,v])=>n[normalizeHeaderKey(k)]=v);for(const k of keys)if(n[normalizeHeaderKey(k)]!==undefined)return n[normalizeHeaderKey(k)];return'';}
async function processActivityFile(){const file=$("#activityFile").files?.[0];if(!file)return toast('Selecione um arquivo.','error');const ext=file.name.split('.').pop().toLowerCase();let rows=[];try{if(ext==='csv'){const text=await file.text(),wb=XLSX.read(text,{type:'string',raw:false}),sh=wb.Sheets[wb.SheetNames[0]];rows=XLSX.utils.sheet_to_json(sh,{defval:''});}else if(['xlsx','xls'].includes(ext)){const buf=await file.arrayBuffer(),wb=XLSX.read(buf,{type:'array'}),sh=wb.Sheets[wb.SheetNames[0]];rows=XLSX.utils.sheet_to_json(sh,{defval:''});}else if(ext==='docx'){const buf=await file.arrayBuffer(),res=await mammoth.extractRawText({arrayBuffer:buf});rows=res.value.replace(/\r/g,'').split(/(?=ATIVIDADE\s+\d+)/gi).map(x=>x.trim()).filter(Boolean).map(block=>{const o={};block.split('\n').forEach(line=>{const m=line.match(/^([^:]+):\s*(.*)$/);if(m)o[m[1].trim()]=m[2].trim();});return o;});}else throw new Error('Formato não suportado.');}catch(err){return toast(err.message,'error',6000);}if(!rows.length)return toast('Nenhuma atividade foi identificada.','error');const result=await importActivityRows(rows,$("#uploadAssignClass").value||null);$("#uploadResult").innerHTML=`<strong>Importação concluída</strong><p>Criadas: ${result.created}<br>Ignoradas/erro: ${result.failed}</p>`;await loadActivities();}
async function importActivityRows(rows,assignClassId){let created=0,failed=0;for(const row of rows){try{const title=String(rowValue(row,'titulo','título','title')).trim(),statement=String(rowValue(row,'enunciado','statement')).trim(),question=String(rowValue(row,'pergunta','question')).trim(),answer=String(rowValue(row,'resposta','answer')).trim(),levelCode=String(rowValue(row,'nivel','nível','level')).trim().toUpperCase(),typeCode=String(rowValue(row,'tipo','type')).trim(),a=rowValue(row,'operando_a','valor_a','dividendo'),b=rowValue(row,'operando_b','valor_b','divisor'),unit=String(rowValue(row,'unidade','unit')).trim();if(!title||!statement){failed++;continue;}const ctx=state.currentContext||{},area=ctx.area?findArea(ctx.area):null;let comp=ctx.component&&area?findComponent(ctx.component,area.id):null;if(!comp&&area)comp=state.components.find(x=>x.area_id===area.id)||null;const mod=ctx.module&&comp?findModule(ctx.module,comp.id):null,level=state.levels.find(x=>x.code.toUpperCase()===levelCode)||null,type=state.activityTypes.find(x=>x.code===typeCode||x.name.toLowerCase()===typeCode.toLowerCase())||state.activityTypes.find(x=>mod?.slug&&['adicao','subtracao','multiplicacao','divisao'].includes(mod.slug)?x.code==='interactive':x.code==='problem_situation');if(!area||!type){failed++;continue;}const op=operationFromModuleSlug(mod?.slug),content={};if(op){content.operation=op;content.material_dourado=true;content.unit=unit;if(op==='division'){content.dividend=Number(a);content.divisor=Number(b);content.exact_division=true;}else{content.operand_a=Number(a);content.operand_b=Number(b);}}let answerKey={};if(answer!==''){const n=Number(answer.replace(',','.'));answerKey=Number.isNaN(n)?{type:'text',accepted:[answer],case_sensitive:false}:{type:'number',value:n,tolerance:0};}const{data,error}=await sb.from('activities').insert({source_type:'professor',created_by:state.professor.id,area_id:area.id,component_id:comp?.id||null,module_id:mod?.id||null,level_id:level?.id||null,activity_type_id:type.id,title,statement,question:question||null,correction_mode:answer!==''?'automatic':'teacher',content,answer_key:answerKey,metadata:{project_version:'7.0',imported_from:'file'}}).select('id').single();if(error){failed++;continue;}if(assignClassId)await assignActivityToClass(data.id,assignClassId,false);created++;}catch{failed++;}}return{created,failed};}

/* ---------- RELATÓRIOS ---------- */
async function prepareReports(){populateClassSelects();const s=$("#reportClassSelect");if(!s.value&&state.classes.length)s.value=state.classes[0].id;if(s.value)await loadParticipationReport();else $("#reportTableWrap").innerHTML='<p>Cadastre uma turma para visualizar relatórios.</p>';}
async function loadParticipationReport(){const classId=$("#reportClassSelect").value;if(!classId){$("#reportTableWrap").innerHTML='<p>Selecione uma turma.</p>';return;}const[st,sub]=await Promise.all([sb.from('students').select('*').eq('class_id',classId),sb.from('submissions').select(`*,activities(id,title,modules(name,slug),areas(name,slug))`).eq('class_id',classId)]);if(st.error)return toast(st.error.message,'error');if(sub.error)return toast(sub.error.message,'error');state.reportStudents=st.data||[];state.reportSubmissions=sub.data||[];buildReportRows();renderReport();subscribeReportRealtime(classId);}
function buildReportRows(){state.reportRows=state.reportStudents.map(student=>{const subs=state.reportSubmissions.filter(s=>s.student_id===student.id),parsed=parseStudentName(student.name),accessed=subs.length,resolved=subs.filter(s=>s.status==='resolved').length,firstAccess=subs.length?subs.map(s=>s.accessed_at).filter(Boolean).sort()[0]:null,lastActivity=subs.length?subs.map(s=>s.updated_at).filter(Boolean).sort().at(-1):null,duration=subs.reduce((sum,s)=>sum+getActiveSecondsFromDraft(s.draft),0);return{student,roster:parsed.valid?parsed.roster:Number(student.username)||999,rosterText:parsed.valid?parsed.rosterText:String(student.username||'').padStart(2,'0'),plainName:parsed.valid?parsed.plainName:student.name,accessed,resolved,firstAccess,lastActivity,duration,submissions:subs};});}
function sortedReportRows(){const mode=$("#reportSort").value,rows=[...state.reportRows];if(mode==='recent')rows.sort((a,b)=>new Date(b.lastActivity||0)-new Date(a.lastActivity||0));else if(mode==='oldest')rows.sort((a,b)=>{if(!a.firstAccess&&!b.firstAccess)return a.roster-b.roster;if(!a.firstAccess)return 1;if(!b.firstAccess)return-1;return new Date(a.firstAccess)-new Date(b.firstAccess);});else if(mode==='duration')rows.sort((a,b)=>b.duration-a.duration||a.roster-b.roster);else rows.sort((a,b)=>a.roster-b.roster||a.plainName.localeCompare(b.plainName,'pt-BR'));return rows;}
function renderReport(){const rows=sortedReportRows();if(!rows.length){$("#reportTableWrap").innerHTML='<p>Nenhum aluno cadastrado nesta turma.</p>';return;}$("#reportTableWrap").innerHTML=`<table class="report-table"><thead><tr><th>Nº</th><th>Aluno</th><th>Primeiro acesso</th><th>Última atividade</th><th>Tempo nos exercícios</th><th>Acessadas</th><th>Resolvidas</th><th></th></tr></thead><tbody>${rows.map(r=>`<tr><td class="roster-cell">${esc(r.rosterText)}</td><td><strong>${esc(r.plainName)}</strong></td><td>${esc(formatDateTime(r.firstAccess))}</td><td>${esc(formatDateTime(r.lastActivity))}</td><td>${esc(formatDuration(r.duration))}</td><td>${r.accessed}</td><td><span class="${r.resolved?'status-ok':'status-warn'}">${r.resolved}</span></td><td><button class="btn btn-small btn-outline" type="button" data-student-detail="${r.student.id}">DETALHES</button></td></tr>`).join('')}</tbody></table>`;$$('[data-student-detail]').forEach(b=>b.addEventListener('click',()=>openStudentDetails(b.dataset.studentDetail)));}
function openStudentDetails(id){const r=state.reportRows.find(x=>x.student.id===id);if(!r)return;$("#studentDetailsTitle").textContent=`${r.rosterText}. ${r.plainName}`;const ordered=[...r.submissions].sort((a,b)=>new Date(a.accessed_at)-new Date(b.accessed_at));$("#studentDetailsBody").innerHTML=ordered.length?ordered.map(s=>`<article class="detail-activity"><h4>${esc(s.activities?.title||'Atividade')}</h4><p>${esc(s.activities?.areas?.name||'')}${s.activities?.modules?.name?' • '+esc(s.activities.modules.name):''}</p><p><strong>Acesso:</strong> ${esc(formatDateTime(s.accessed_at))}</p><p><strong>Tempo ativo:</strong> ${esc(formatDuration(getActiveSecondsFromDraft(s.draft)))}</p><p><strong>Tentativas:</strong> ${s.attempts||0} • <strong>Status:</strong> ${esc(s.status||'—')}</p></article>`).join(''):'<p>Nenhuma atividade acessada.</p>';$("#studentDetailsModal").classList.remove('hidden');}
async function subscribeReportRealtime(classId){if(state.realtimeChannel)await sb.removeChannel(state.realtimeChannel);state.realtimeChannel=sb.channel(`class-${classId}-v7`).on('postgres_changes',{event:'*',schema:'public',table:'submissions',filter:`class_id=eq.${classId}`},async()=>{if($("#workReports").classList.contains('active'))await loadParticipationReport();}).subscribe();}
function downloadReportHtml(){const classId=$("#reportClassSelect").value,c=state.classes.find(x=>x.id===classId);if(!c)return toast('Selecione uma turma.','error');const rows=sortedReportRows(),html=`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Relatório</title><style>body{font-family:Arial;padding:30px;color:#111}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #ccc;padding:8px;text-align:left}th{background:#eee}</style><body><h1>Relatório de Participação</h1><p>${esc(c.name)} • Projeto Educacional 7.0</p><table><thead><tr><th>Nº</th><th>Aluno</th><th>Primeiro acesso</th><th>Última atividade</th><th>Tempo nos exercícios</th><th>Acessadas</th><th>Resolvidas</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.rosterText)}</td><td>${esc(r.plainName)}</td><td>${esc(formatDateTime(r.firstAccess))}</td><td>${esc(formatDateTime(r.lastActivity))}</td><td>${esc(formatDuration(r.duration))}</td><td>${r.accessed}</td><td>${r.resolved}</td></tr>`).join('')}</tbody></table></body></html>`;const blob=new Blob([html],{type:'text/html;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`relatorio_${normalizeClassCode(c.name)}.html`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);}

/* ---------- ALUNO ---------- */
async function showStudentDashboard(){stopActivityTimer(true);if(!state.student)return;$("#studentWelcome").textContent=`Olá, ${studentPlainName(state.student.name)}.`;$("#studentClassInfo").textContent=state.currentClass?`${state.currentClass.name} • Código ${state.currentClass.code}`:'';const{data,error}=await sb.rpc('get_my_class_activities',{p_level_code:null,p_area_slug:null});if(error)return toast(error.message,'error');renderStudentActivities(data||[]);setTopbar(true,'student');showScreen('screenStudentDashboard');}
function renderStudentActivities(items){const c=$("#studentActivityGroups");if(!items.length){c.innerHTML='<div class="panel-card"><h2>Nenhuma atividade liberada ainda.</h2><p class="muted">Quando o professor liberar atividades para sua turma, elas aparecerão aqui.</p></div>';return;}const groups=new Map();items.forEach(i=>{const k=`${i.area_name||'Área'} • ${i.module_name||i.component_name||'Atividades'}`;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(i);});c.innerHTML=[...groups.entries()].map(([title,list])=>`<section class="student-group"><h2>${esc(title)}</h2><div class="student-activity-grid">${list.map(i=>`<button class="student-activity-card" type="button" data-student-activity="${i.class_activity_id}"><span class="eyebrow">${esc(i.level_code||'')}</span><h3>${esc(i.title)}</h3><p>${esc(i.statement)}</p><div class="badge-row"><span class="badge">${i.progress_status==='resolved'?'Resolvida':i.progress_status==='not_accessed'?'Não acessada':'Em andamento'}</span><span class="badge">Tentativas: ${i.attempts||0}</span></div></button>`).join('')}</div></section>`).join('');$$('[data-student-activity]').forEach(b=>b.addEventListener('click',()=>{const item=items.find(x=>x.class_activity_id===b.dataset.studentActivity);if(item)openStudentActivity(item);}));}
async function openStudentActivity(item){state.currentActivity=item;state.currentClassActivity=item.class_activity_id;const{error}=await sb.rpc('open_activity',{p_class_activity_id:item.class_activity_id});if(error)return toast(error.message,'error');const{data:sub}=await sb.from('submissions').select('*').eq('class_activity_id',item.class_activity_id).eq('student_id',state.student.id).maybeSingle();state.currentDraft=sub?.draft&&typeof sub.draft==='object'?sub.draft:{};state.activeSeconds=getActiveSecondsFromDraft(state.currentDraft);$("#studentActivityMeta").textContent=[item.area_name,item.module_name,item.level_code].filter(Boolean).join(' • ');$("#studentActivityTitle").textContent=item.title;$("#studentActivityStatement").textContent=item.statement||'';$("#studentActivityQuestion").textContent=item.question||'';$("#studentScratch").value=state.currentDraft.studentScratch||'';renderStudentAnswerArea(item);renderInteractiveArea(item);showScreen('screenStudentActivity');startActivityTimer();$("#studentScratch").oninput=debounce(saveCurrentDraft,700);}
function markInteraction(){state.lastInteraction=Date.now();}
function startActivityTimer(){stopActivityTimer(false);state.lastTick=Date.now();state.lastInteraction=Date.now();$("#activityTimerDisplay").textContent=timerText(state.activeSeconds);state.timerHandle=setInterval(()=>{const now=Date.now(),active=!document.hidden&&(now-state.lastInteraction)<120000;if(active){const delta=Math.max(0,Math.min(2,Math.round((now-state.lastTick)/1000)));state.activeSeconds+=delta;$("#activityTimerDisplay").textContent=timerText(state.activeSeconds);}state.lastTick=now;},1000);state.timerHeartbeat=setInterval(()=>{if(!document.hidden)saveCurrentDraft();},15000);}
function stopActivityTimer(save=true){if(state.timerHandle){clearInterval(state.timerHandle);state.timerHandle=null;}if(state.timerHeartbeat){clearInterval(state.timerHeartbeat);state.timerHeartbeat=null;}if(save&&state.currentClassActivity)saveCurrentDraft();state.lastTick=null;}
async function saveCurrentDraft(){if(!state.currentClassActivity||state.role!=='student')return;state.currentDraft={...state.currentDraft,studentScratch:$("#studentScratch")?.value||'',_tracking:{...(state.currentDraft._tracking||{}),activeSeconds:state.activeSeconds,lastHeartbeat:new Date().toISOString(),projectVersion:'7.0'}};const{error}=await sb.rpc('save_my_draft',{p_class_activity_id:state.currentClassActivity,p_draft:state.currentDraft});if(error)console.error('Erro ao salvar rascunho:',error.message);}
function renderStudentAnswerArea(item){const a=$("#studentAnswerArea");if(item.activity_type==='open_text'||item.correction_mode==='teacher'){a.innerHTML='<label>Resposta final<textarea id="studentFinalText" rows="5"></textarea></label><button id="submitStudentAnswerBtn" class="btn btn-primary" type="button">ENVIAR RESPOSTA</button>';$("#studentFinalText").value=state.currentDraft.finalText||'';}else{a.innerHTML='<div class="answer-actions"><label>Resposta final<input id="studentFinalAnswer" type="text" inputmode="decimal" placeholder="Digite sua resposta"></label><button id="submitStudentAnswerBtn" class="btn btn-primary" type="button">ENVIAR RESPOSTA</button></div>';$("#studentFinalAnswer").value=state.currentDraft.finalAnswer||'';}$("#submitStudentAnswerBtn").addEventListener('click',submitStudentAnswer);}
async function submitStudentAnswer(){const ta=$("#studentFinalText"),inp=$("#studentFinalAnswer");let response;if(ta){const v=ta.value.trim();state.currentDraft.finalText=v;response={value:v};}else{const raw=inp?.value.trim()||'',n=Number(raw.replace(',','.'));state.currentDraft.finalAnswer=raw;response=Number.isNaN(n)?{value:raw}:{value:n};}await saveCurrentDraft();const{data,error}=await sb.rpc('submit_answer',{p_class_activity_id:state.currentClassActivity,p_response:response});if(error)return toast(error.message,'error',6000);const row=Array.isArray(data)?data[0]:data,fb=$("#studentAnswerFeedback");fb.classList.remove('hidden','correct','incorrect');if(row?.needs_review){fb.classList.add('correct');fb.textContent='Resposta enviada. O professor fará a avaliação.';}else if(row?.is_correct){fb.classList.add('correct');fb.textContent='Sua resposta está correta. Parabéns!';}else{fb.classList.add('incorrect');fb.textContent='Resposta incorreta. Revise sua estratégia e tente novamente.';}}

/* ---------- MATERIAL DOURADO DIVISÃO ---------- */
function renderInteractiveArea(item){const c=$("#interactiveArea"),content=item.content||{};if(content.operation==='division'&&content.material_dourado)return renderDivisionMaterialBoard(c,content);if(['addition','subtraction','multiplication'].includes(content.operation)){const sym={addition:'+',subtraction:'−',multiplication:'×'};c.innerHTML=`<div class="panel-card"><span class="eyebrow">OPERAÇÃO</span><h2 style="font-size:2.4rem;margin:10px 0">${esc(content.operand_a)} ${sym[content.operation]} ${esc(content.operand_b)}</h2><p class="muted">A resposta final é registrada online. A manipulação específica desta operação pode ser ampliada em versões futuras sem alterar o banco.</p></div>`;return;}c.innerHTML='';}
function renderDivisionMaterialBoard(container,content){const dividend=Number(content.dividend),divisor=Number(content.divisor);if(!Number.isFinite(dividend)||!Number.isFinite(divisor)||divisor<=0){container.innerHTML='';return;}const board={confirmed:false,available:{M:0,C:0,D:0,U:0},groups:Array.from({length:divisor},()=>({M:0,C:0,D:0,U:0}))},vals={M:1000,C:100,D:10,U:1},labels={M:'Milhar',C:'Centena',D:'Dezena',U:'Unidade'},value=o=>Object.entries(o).reduce((s,[k,n])=>s+vals[k]*n,0);const render=()=>{container.innerHTML=`<div class="material-board"><section class="material-panel"><span class="eyebrow">MATERIAL DOURADO</span><h2>Represente ${dividend}</h2><div class="place-value-grid">${['M','C','D','U'].map(k=>`<div class="place-value"><strong>${labels[k]}</strong><span class="count">${board.available[k]}</span><div class="piece-controls"><button type="button" data-minus="${k}">−</button><button type="button" data-plus="${k}">+</button></div></div>`).join('')}</div><div class="material-status">Valor representado: <strong>${value(board.available)}</strong> • Valor necessário: <strong>${dividend}</strong></div><div class="card-actions"><button id="confirmRepresentationBtn" class="btn btn-primary" type="button">✓ CONFIRMAR REPRESENTAÇÃO</button><button id="resetMaterialBtn" class="btn btn-outline" type="button">Refazer representação</button></div></section>${board.confirmed?`<section class="material-panel"><span class="eyebrow">TROCAS</span><h3>Trocas disponíveis</h3><div class="exchange-row"><button data-ex="M-C">1 milhar → 10 centenas</button><button data-ex="C-D">1 centena → 10 dezenas</button><button data-ex="D-U">1 dezena → 10 unidades</button><button data-ex="U-D">10 unidades → 1 dezena</button></div><span class="eyebrow">CAIXAS DO DIVISOR</span><h3>Distribua igualmente entre ${divisor} grupos</h3><div class="groups-grid">${board.groups.map((g,i)=>`<article class="group-box"><h4>Grupo ${i+1}</h4><div class="group-value">Valor: ${value(g)}</div><p class="muted">M:${g.M} C:${g.C} D:${g.D} U:${g.U}</p><div class="distribution-buttons">${['M','C','D','U'].map(k=>`<button type="button" data-send="${k}" data-gi="${i}" ${board.available[k]<=0?'disabled':''}>+ ${k}</button>`).join('')}</div></article>`).join('')}</div><div class="card-actions"><button id="checkDistributionBtn" class="btn btn-primary" type="button">✓ CONFERIR O RESULTADO</button><button id="collectPiecesBtn" class="btn btn-outline" type="button">↺ Recolher todas as peças</button></div><div id="distributionFeedback" class="material-status">Distribua todas as peças igualmente.</div></section>`:''}</div>`;
      $$('[data-plus]',container).forEach(b=>b.onclick=()=>{board.available[b.dataset.plus]++;board.confirmed=false;render();});$$('[data-minus]',container).forEach(b=>b.onclick=()=>{const k=b.dataset.minus;board.available[k]=Math.max(0,board.available[k]-1);board.confirmed=false;render();});$('#confirmRepresentationBtn',container)?.addEventListener('click',()=>{if(value(board.available)!==dividend)return toast('A representação ainda não corresponde ao dividendo.','error');board.confirmed=true;render();toast('Representação correta. Agora distribua as peças.','success');});$('#resetMaterialBtn',container)?.addEventListener('click',()=>{board.available={M:0,C:0,D:0,U:0};board.groups=Array.from({length:divisor},()=>({M:0,C:0,D:0,U:0}));board.confirmed=false;render();});$$('[data-ex]',container).forEach(b=>b.onclick=()=>{const a=b.dataset.ex;if(a==='M-C'&&board.available.M>=1){board.available.M--;board.available.C+=10;}else if(a==='C-D'&&board.available.C>=1){board.available.C--;board.available.D+=10;}else if(a==='D-U'&&board.available.D>=1){board.available.D--;board.available.U+=10;}else if(a==='U-D'&&board.available.U>=10){board.available.U-=10;board.available.D++;}else return toast('Não há peças suficientes para essa troca.','error');render();});$$('[data-send]',container).forEach(b=>b.onclick=()=>{const k=b.dataset.send,i=Number(b.dataset.gi);if(board.available[k]<=0)return;board.available[k]--;board.groups[i][k]++;render();});$('#collectPiecesBtn',container)?.addEventListener('click',()=>{board.groups.forEach(g=>['M','C','D','U'].forEach(k=>{board.available[k]+=g[k];g[k]=0;}));render();});$('#checkDistributionBtn',container)?.addEventListener('click',()=>{const quotient=dividend/divisor,ok=value(board.available)===0&&board.groups.every(g=>value(g)===quotient),fb=$('#distributionFeedback',container);fb.textContent=ok?`Distribuição correta. Cada grupo representa ${quotient}.`:'A distribuição ainda não está correta. Revise as trocas e os grupos.';toast(ok?'Distribuição correta. Parabéns!':'Revise a distribuição.',ok?'success':'error');});};render();}

/* ---------- NAVEGAÇÃO/EVENTOS ---------- */
function openAuthTab(role,tab){if(role==='professor'){$$('[data-prof-tab]').forEach(b=>b.classList.toggle('active',b.dataset.profTab===tab));$("#professorLoginForm").classList.toggle('hidden',tab!=='login');$("#professorRegisterForm").classList.toggle('hidden',tab!=='register');}else{$$('[data-student-tab]').forEach(b=>b.classList.toggle('active',b.dataset.studentTab===tab));$("#studentLoginForm").classList.toggle('hidden',tab!=='login');$("#studentRegisterForm").classList.toggle('hidden',tab!=='register');}}

/* ============================================================
   VISUALIZAR / OCULTAR SENHAS
   ============================================================ */

function setupPasswordToggles(){
  $$("[data-password-toggle]").forEach(button=>{
    if(button.dataset.bound==="true") return;

    const field=button.closest(".password-field");
    const input=field?.querySelector('input[type="password"], input[type="text"]');

    if(!input) return;

    button.dataset.bound="true";

    button.addEventListener("click",()=>{
      const showing=input.type==="text";

      input.type=showing ? "password" : "text";
      button.textContent=showing ? "Mostrar" : "Ocultar";
      button.setAttribute(
        "aria-label",
        showing ? "Mostrar senha" : "Ocultar senha"
      );
      button.setAttribute(
        "title",
        showing ? "Mostrar senha" : "Ocultar senha"
      );
    });
  });
}

function bindEvents(){$("#openProfessorAccessBtn").onclick=()=>showScreen('screenProfessorAuth');$("#openStudentAccessBtn").onclick=()=>showScreen('screenStudentAuth');$$('[data-back-landing]').forEach(b=>b.onclick=()=>showScreen('screenLanding'));$$('[data-prof-tab]').forEach(b=>b.onclick=()=>openAuthTab('professor',b.dataset.profTab));$$('[data-student-tab]').forEach(b=>b.onclick=()=>openAuthTab('student',b.dataset.studentTab));$("#professorLoginForm").onsubmit=professorLogin;$("#professorRegisterForm").onsubmit=professorRegister;$("#studentLoginForm").onsubmit=studentLogin;$("#studentRegisterForm").onsubmit=studentRegister;$("#logoutBtn").onclick=logout;$("#adminGateForm").onsubmit=submitAdminGate;$("#adminGateLogoutBtn").onclick=logout;$("#goHomeBtn").onclick=()=>state.role==='professor'?showProfessorHome():showStudentDashboard();$$('[data-nav]').forEach(b=>b.onclick=async()=>{const nav=b.dataset.nav;if(nav==='home')return showProfessorHome();if(nav==='profile')return showProfessorProfile();if(!state.currentContext){await showProfessorHome();return toast('Escolha uma capa para abrir esse ambiente.');}showScreen('screenWorkspace');setWorkspaceTab(nav==='classes'?'classes':nav==='activities'?'activities':'reports');});$$('[data-student-nav]').forEach(b=>b.onclick=showStudentDashboard);$("#workspaceBackBtn").onclick=showProfessorHome;$$('.workspace-tab').forEach(b=>b.onclick=()=>setWorkspaceTab(b.dataset.workTab));$$('[data-open-work]').forEach(b=>b.onclick=()=>setWorkspaceTab(b.dataset.openWork));$("#classForm").onsubmit=saveClass;$("#generateClassCodeBtn").onclick=()=>$("#classCode").value=makeRandomClassCode();$("#cancelClassEditBtn").onclick=resetClassForm;$("#refreshClassesBtn").onclick=loadClasses;$("#refreshActivitiesBtn").onclick=loadActivities;$("#activityComponent").onchange=fillModulesForSelectedComponent;$("#activityModule").onchange=updateMathFieldsVisibility;$("#activityForm").onsubmit=createActivity;$("#processActivityFileBtn").onclick=processActivityFile;$("#reportClassSelect").onchange=loadParticipationReport;$("#reportSort").onchange=renderReport;$("#refreshReportBtn").onclick=loadParticipationReport;$("#downloadReportBtn").onclick=downloadReportHtml;$("#profileBackBtn").onclick=showProfessorHome;$("#changeKeyForm").onsubmit=changeMyAccessKey;$("#requireAdminKeyToggle").onchange=setAdminKeyRequired;$("#backToStudentDashboardBtn").onclick=showStudentDashboard;$("#closeStudentDetailsBtn").onclick=()=>$("#studentDetailsModal").classList.add('hidden');['pointerdown','keydown','touchstart','mousemove'].forEach(evt=>document.addEventListener(evt,markInteraction,{passive:true}));document.addEventListener('visibilitychange',()=>{if(!document.hidden&&state.timerHandle){state.lastTick=Date.now();state.lastInteraction=Date.now();}});window.addEventListener('beforeunload',()=>{if(state.role==='student'&&state.currentClassActivity)saveCurrentDraft();});}
async function init(){
  setupPasswordToggles();bindEvents();$("#classYear").value=new Date().getFullYear();$("#classCode").value=makeRandomClassCode();await initSession();}
document.addEventListener('DOMContentLoaded',init);
