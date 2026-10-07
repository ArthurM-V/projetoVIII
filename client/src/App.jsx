import { useEffect, useRef, useState } from 'react'
import './App.css'
import carouselArrow from './assets/arrow_forward_ios_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg'

const fallbackOrganizations = [
  { id: 'casa-aurora', name: 'Casa Aurora', category: 'Acolhimento infantil', distance: '1,2 km', initials: 'CA', color: 'coral', needs: 'Itens de higiene' },
  { id: 'instituto-sementes', name: 'Instituto Sementes', category: 'Educação e cultura', distance: '2,8 km', initials: 'IS', color: 'violet', needs: 'Material escolar' },
  { id: 'projeto-vira-lata', name: 'Projeto Vira-Lata', category: 'Causa animal', distance: '4,1 km', initials: 'PV', color: 'yellow', needs: 'Ração e remédios' },
  { id: 'rede-recomeco', name: 'Rede Recomeço', category: 'Assistência social', distance: '5,6 km', initials: 'RR', color: 'green', needs: 'Cestas básicas' },
]

// No deploy integrado, o frontend e a API usam o mesmo domínio. No Vite local,
// mantemos a API do Express na porta 5000.
const apiBaseUrl = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:5000' : '')
let googleMapsPromise

function loadGoogleMaps(apiKey) {
  if (window.google?.maps) return Promise.resolve(window.google.maps)
  if (googleMapsPromise) return googleMapsPromise

  googleMapsPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&language=pt-BR`
    script.async = true
    script.onload = () => resolve(window.google.maps)
    script.onerror = () => reject(new Error('Não foi possível carregar o Google Maps.'))
    document.head.appendChild(script)
  })

  return googleMapsPromise
}

function useOrganizations() {
  const [organizations, setOrganizations] = useState(fallbackOrganizations)

  useEffect(() => {
    const controller = new AbortController()

    fetch(`${apiBaseUrl}/api/instituicoes`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('Não foi possível carregar as instituições.'))))
      .then((institutions) => {
        if (!Array.isArray(institutions) || institutions.length === 0) return
        setOrganizations(institutions.map((institution, index) => {
          const words = institution.nome.split(' ').filter((word) => word !== '—' && word !== 'demonstração')
          return {
            id: String(institution.id),
            name: institution.nome.replace(' — demonstração', ''),
            category: institution.categoria,
            distance: [institution.bairro, institution.cidade].filter(Boolean).join(', '),
            position: institution.latitude != null && institution.longitude != null ? { lat: Number(institution.latitude), lng: Number(institution.longitude) } : null,
            initials: words.slice(0, 2).map((word) => word[0]).join('').toUpperCase(),
            color: ['coral', 'violet', 'yellow', 'green'][index % 4],
            needs: institution.demanda_atual || 'Sem demandas ativas',
          }
        }))
      })
      .catch(() => {})

    return () => controller.abort()
  }, [])

  return organizations
}

function HeartIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.8a5.5 5.5 0 0 0-7.8 0L12 5.9l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.4 1-1a5.5 5.5 0 0 0 0-7.8Z" /></svg>
}

function PinIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 5.3-8 11-8 11S4 15.3 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.7" /></svg>
}

function initialsFromName(name) {
  return String(name).trim().split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join('').toUpperCase() || 'ONG'
}

function AccountNavigation() {
  const [account, setAccount] = useState(null)

  useEffect(() => {
    const controller = new AbortController()
    async function loadSession() {
      try {
        const response = await fetch(`${apiBaseUrl}/api/sessao`, { credentials: 'include', signal: controller.signal })
        if (response.ok) setAccount(await response.json())
      } catch (error) {
        if (error.name !== 'AbortError') setAccount(null)
      }
    }
    loadSession()
    return () => controller.abort()
  }, [])

  async function logout() {
    try {
      await fetch(`${apiBaseUrl}/api/logout`, { method: 'POST', credentials: 'include' })
    } finally {
      window.location.href = '/'
    }
  }

  if (account?.perfil === 'instituicao') return <><a className="account-nav-link" href="/instituicoes/perfil">Meu painel</a><button className="account-nav-button" type="button" onClick={logout}>Sair</button></>
  if (account?.perfil === 'usuario') return <><a className="account-nav-link" href="/usuario/perfil">Meu perfil</a><button className="account-nav-button" type="button" onClick={logout}>Sair</button></>
  return <><a href="/instituicoes">Para instituições</a><a className="login-link" href="/login">Entrar</a><a className="join-button" href="/cadastro">Criar conta</a></>
}

function NearOrganizationCard({ organization }) {
  return (
    <article className="near-organization-card">
      <a className="near-organization-link" href={`/instituicoes/${organization.id}`} aria-label={`Ver perfil de ${organization.name}`}>
        <span className={`near-avatar ${organization.color}`}>{organization.initials}</span>
        <span className="near-organization-copy">
          <strong>{organization.name}</strong>
          <span>{organization.category}</span>
          <small><PinIcon /> {organization.distance}</small>
        </span>
      </a>
    </article>
  )
}

function ExpandedOrganizationCard({ organization }) {
  return (
    <article className="expanded-organization-card">
      <a className="expanded-organization-link" href={`/instituicoes/${organization.id}`} aria-label={`Ver perfil de ${organization.name}`}>
        <span className={`near-avatar ${organization.color}`}>{organization.initials}</span>
        <span className="expanded-organization-copy"><strong>{organization.name}</strong><span>{organization.category}</span><small><PinIcon /> {organization.distance}</small></span>
      </a>
      <a className="see-map-button" href={`/mapa?instituicao=${organization.id}`}>Ver no mapa <span>↗</span></a>
    </article>
  )
}

function HowItWorksCard({ onClose }) {
  return (
    <section className="how-it-works-card" role="dialog" aria-labelledby="how-it-works-title">
      <button className="dialog-close" type="button" onClick={onClose} aria-label="Fechar como funciona">×</button>
      <p className="eyebrow"><span className="live-dot" /> COMO FUNCIONA</p>
      <h2 id="how-it-works-title">Pequenos gestos criam grandes <em>laços.</em></h2>
      <p className="how-it-works-summary">Você encontra uma instituição verificada, escolhe uma demanda e combina a entrega diretamente com ela.</p>
      <ol className="donation-steps">
        <li><span>01</span><div><strong>Encontre uma causa</strong><p>Explore instituições e demandas próximas de você.</p></div></li>
        <li><span>02</span><div><strong>Escolha como ajudar</strong><p>Doe itens solicitados ou manifeste interesse em doar dinheiro.</p></div></li>
        <li><span>03</span><div><strong>Combine diretamente</strong><p>A instituição entra em contato para organizar a doação.</p></div></li>
      </ol>
      <p className="payment-note">A plataforma não processa pagamentos.</p>
      <button type="button" className="start-donating-button" onClick={onClose}>Comece a Doar! <span>→</span></button>
    </section>
  )
}

const categoryOptions = ['Assistência social', 'Causa animal', 'Educação e cultura', 'Meio ambiente', 'Saúde e bem-estar']

function InstitutionRegistrationPage() {
  const [selectedCategories, setSelectedCategories] = useState([])
  const [status, setStatus] = useState({ type: '', message: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)

  function toggleCategory(category) {
    setSelectedCategories((current) => current.includes(category)
      ? current.filter((item) => item !== category)
      : [...current, category])
  }

  async function submitRegistration(event) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const payload = {
      nome: formData.get('nome'),
      cnpj: formData.get('cnpj'),
      email: formData.get('email'),
      telefone: formData.get('telefone'),
      senha: formData.get('senha'),
      endereco: {
        logradouro: formData.get('logradouro'), numero: formData.get('numero'), complemento: formData.get('complemento'),
        bairro: formData.get('bairro'), cidade: formData.get('cidade'), estado: formData.get('estado'), cep: formData.get('cep'),
      },
      categorias: selectedCategories,
    }

    setIsSubmitting(true)
    setStatus({ type: '', message: '' })
    try {
      const response = await fetch(`${apiBaseUrl}/api/instituicoes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message)
      event.currentTarget.reset()
      setSelectedCategories([])
      setStatus({ type: 'success', message: 'Cadastro enviado! Nossa equipe fará a validação da sua instituição.' })
    } catch (error) {
      setStatus({ type: 'error', message: error.message || 'Não foi possível enviar o cadastro. Tente novamente.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="registration-page">
      <header className="registration-header">
        <a className="brand" href="/" aria-label="Laço, voltar à página inicial"><span><HeartIcon /></span>laço</a>
        <div className="registration-nav"><a href="/login">Já sou parceira</a><a className="back-home" href="/">← Voltar para instituições</a></div>
      </header>
      <section className="registration-layout">
        <aside className="registration-intro">
          <p className="eyebrow"><span className="live-dot" /> PARA INSTITUIÇÕES</p>
          <h1>Vamos tornar sua causa mais <em>visível.</em></h1>
          <p>Após o envio, conferimos seus dados antes de liberar o cadastro de demandas na plataforma.</p>
          <div className="validation-note"><strong>Como funciona a validação</strong><span>01</span><p>Conferimos as informações da organização.</p><span>02</span><p>Com a aprovação, sua instituição pode publicar demandas.</p></div>
        </aside>
        <section className="registration-form-card" aria-labelledby="registration-title">
          <div className="form-heading"><p className="eyebrow">CADASTRO DA INSTITUIÇÃO</p><h2 id="registration-title">Conte-nos sobre sua organização</h2><p>Campos marcados com <b>*</b> são obrigatórios.</p></div>
          <form onSubmit={submitRegistration}>
            <fieldset><legend>Dados da instituição</legend><div className="form-grid"><label className="field full">Nome da instituição <b>*</b><input name="nome" required placeholder="Ex.: Instituto Sementes" /></label><label className="field">CNPJ <b>*</b><input name="cnpj" required inputMode="numeric" placeholder="00.000.000/0000-00" /></label><label className="field">Telefone<input name="telefone" type="tel" placeholder="(00) 00000-0000" /></label><label className="field full">E-mail institucional <b>*</b><input name="email" type="email" required placeholder="contato@instituicao.org.br" /></label><label className="field full">Senha de acesso <b>*</b><input name="senha" type="password" required minLength="8" pattern="(?=.*[A-Z])(?=.*[^A-Za-z0-9\s]).{8,}" title="Use no mínimo 8 caracteres, uma letra maiúscula e um caractere especial." placeholder="Crie uma senha segura" /><small className="password-requirements">Mínimo de 8 caracteres, uma maiúscula e um caractere especial.</small></label></div></fieldset>
            <fieldset><legend>Endereço</legend><div className="form-grid"><label className="field full">Logradouro <b>*</b><input name="logradouro" required placeholder="Rua, avenida ou estrada" /></label><label className="field small-field">Número<input name="numero" placeholder="123" /></label><label className="field">Complemento<input name="complemento" placeholder="Sala, bloco, etc." /></label><label className="field full">Bairro<input name="bairro" placeholder="Nome do bairro" /></label><label className="field">Cidade <b>*</b><input name="cidade" required placeholder="Sua cidade" /></label><label className="field state-field">UF <b>*</b><select name="estado" required defaultValue=""><option value="" disabled>UF</option>{['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map((state) => <option key={state}>{state}</option>)}</select></label><label className="field">CEP <b>*</b><input name="cep" required inputMode="numeric" placeholder="00000-000" /></label></div></fieldset>
            <fieldset><legend>Áreas de atuação</legend><p className="fieldset-help">Selecione as categorias que melhor representam sua instituição.</p><div className="category-options">{categoryOptions.map((category) => <label key={category} className={`category-option ${selectedCategories.includes(category) ? 'is-selected' : ''}`}><input type="checkbox" checked={selectedCategories.includes(category)} onChange={() => toggleCategory(category)} /><span>{category}</span></label>)}</div></fieldset>
            {status.message && <p className={`form-status ${status.type}`} role="status">{status.message}</p>}
            <button className="submit-registration" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Enviando cadastro…' : 'Enviar para validação'} <span>→</span></button>
          </form>
        </section>
      </section>
    </main>
  )
}

function UserRegistrationPage() {
  const [status, setStatus] = useState({ type: '', message: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function submitRegistration(event) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const payload = {
      nome: formData.get('nome'), cpf: formData.get('cpf'), email: formData.get('email'), telefone: formData.get('telefone'), senha: formData.get('senha'),
      cep: formData.get('cep'),
    }
    setIsSubmitting(true)
    setStatus({ type: '', message: '' })
    try {
      const response = await fetch(`${apiBaseUrl}/api/usuarios`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message)
      event.currentTarget.reset()
      setStatus({ type: 'success', message: 'Conta criada! Agora você já pode entrar e encontrar causas perto de você.' })
    } catch (error) {
      setStatus({ type: 'error', message: error.message || 'Não foi possível criar sua conta.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="registration-page user-registration-page">
      <header className="registration-header"><a className="brand" href="/" aria-label="Laço, voltar à página inicial"><span><HeartIcon /></span>laço</a><div className="registration-nav"><a href="/login">Já tenho uma conta</a><a className="back-home" href="/">← Voltar para o início</a></div></header>
      <section className="registration-layout">
        <aside className="registration-intro"><p className="eyebrow"><span className="live-dot" /> PARA QUEM QUER DOAR</p><h1>Todo gesto de cuidado pode criar um novo <em>laço.</em></h1><p>Crie sua conta para encontrar instituições verificadas e acompanhar as causas que você apoia.</p><div className="user-benefits"><strong>Com sua conta você pode</strong><p><span>✓</span> Encontrar instituições perto de você.</p><p><span>✓</span> Doar itens ou manifestar intenção de doação em dinheiro.</p><p><span>✓</span> Acompanhar suas doações registradas.</p></div></aside>
        <section className="registration-form-card" aria-labelledby="user-registration-title"><div className="form-heading"><p className="eyebrow">CRIAR CONTA</p><h2 id="user-registration-title">Seus dados de acesso</h2><p>Campos marcados com <b>*</b> são obrigatórios.</p></div><form onSubmit={submitRegistration}><fieldset><legend>Dados pessoais</legend><div className="form-grid"><label className="field full">Nome completo <b>*</b><input name="nome" required placeholder="Como você gostaria de ser chamado" /></label><label className="field">CPF <b>*</b><input name="cpf" required inputMode="numeric" placeholder="000.000.000-00" /></label><label className="field">Telefone<input name="telefone" type="tel" placeholder="(00) 00000-0000" /></label><label className="field full">E-mail <b>*</b><input name="email" type="email" required placeholder="voce@exemplo.com" /></label><label className="field full">Senha <b>*</b><input name="senha" type="password" required minLength="8" pattern="(?=.*[A-Z])(?=.*[^A-Za-z0-9\s]).{8,}" title="Use no mínimo 8 caracteres, uma letra maiúscula e um caractere especial." placeholder="Crie uma senha segura" /><small className="password-requirements">Mínimo de 8 caracteres, uma maiúscula e um caractere especial.</small></label></div></fieldset><fieldset><legend>Sua região</legend><p className="fieldset-help">Usamos somente seu CEP para estimar instituições próximas. Não coletamos seu endereço residencial.</p><div className="form-grid"><label className="field full">CEP <b>*</b><input name="cep" required inputMode="numeric" autoComplete="postal-code" pattern="[0-9]{5}-?[0-9]{3}" title="Informe um CEP com 8 dígitos." placeholder="00000-000" /></label></div></fieldset>{status.message && <p className={`form-status ${status.type}`} role="status">{status.message}</p>}<button className="submit-registration" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Criando conta…' : 'Criar minha conta'} <span>→</span></button></form></section>
      </section>
    </main>
  )
}

function LoginPage() {
  const [status, setStatus] = useState({ type: '', message: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function submitLogin(event) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const senha = formData.get('senha')
    if (senha.length < 8 || !/[A-Z]/.test(senha) || !/[^A-Za-z0-9\s]/.test(senha)) {
      setStatus({ type: 'error', message: 'Use uma senha com ao menos 8 caracteres, uma letra maiúscula e um caractere especial.' })
      return
    }
    setIsSubmitting(true)
    setStatus({ type: '', message: '' })
    try {
      const response = await fetch(`${apiBaseUrl}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ identificador: formData.get('identificador'), senha }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message)
      setStatus({ type: 'success', message: `Acesso validado. Olá, ${data.nome}!` })
      const requestedReturn = new URLSearchParams(window.location.search).get('retorno')
      const safeReturn = requestedReturn?.startsWith('/') ? requestedReturn : null
      window.setTimeout(() => { window.location.href = data.perfil === 'instituicao' ? '/instituicoes/perfil' : (safeReturn || '/usuario/perfil') }, 550)
    } catch (error) {
      setStatus({ type: 'error', message: error.message || 'Não foi possível validar o acesso.' })
      setIsSubmitting(false)
    }
  }

  return (
    <main className="login-page">
      <header className="login-header"><a className="brand" href="/" aria-label="Laço, página inicial"><span><HeartIcon /></span>laço</a><a href="/" className="back-home">← Voltar para o início</a></header>
      <section className="login-layout">
        <div className="login-intro"><p className="eyebrow"><span className="live-dot" /> BEM-VINDO DE VOLTA</p><h1>Uma mesma porta para quem doa e para quem <em>transforma.</em></h1><p>Entre para acompanhar suas doações ou administrar as demandas da sua instituição.</p></div>
        <section className="login-card" aria-labelledby="login-title"><p className="eyebrow">ACESSAR A PLATAFORMA</p><h2 id="login-title">Entre na sua conta</h2><p>Use seu e-mail, CPF ou CNPJ.</p><form onSubmit={submitLogin}><label>E-mail, CPF ou CNPJ<input name="identificador" required placeholder="nome@exemplo.com" autoComplete="username" /></label><label>Senha<input name="senha" type="password" required minLength="8" autoComplete="current-password" placeholder="Sua senha" /><small>Ao menos 8 caracteres, 1 maiúscula e 1 especial.</small></label>{status.message && <p className={`login-status ${status.type}`} role="status">{status.message}</p>}<button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Validando…' : 'Entrar'} <span>→</span></button></form><div className="login-footer"><span>Não tem uma conta?</span><a href="/cadastro">Criar conta</a><a href="/instituicoes">Sou instituição</a></div></section>
      </section>
    </main>
  )
}

const defaultDemandImage = 'https://images.unsplash.com/photo-1497486751825-1233686d5d80?auto=format&fit=crop&w=800&q=80'
const demandClassificationLabels = { pontual: 'Pontual', urgente: 'Urgente', mensal: 'Fixa mensal' }

function formatDemand(demand) {
  return {
    id: demand.id,
    title: demand.titulo,
    description: demand.descricao || '',
    image: demand.imagem_url || defaultDemandImage,
    type: demand.tipo === 'dinheiro' ? 'Dinheiro' : 'Itens',
    classification: demand.classificacao || 'pontual',
    classificationLabel: demandClassificationLabels[demand.classificacao] || demandClassificationLabels.pontual,
    status: demand.status === 'pausada' ? 'Pausada' : 'Ativa',
  }
}

function InstitutionProfilePage({ isEditingProfile = false }) {
  const [access, setAccess] = useState('checking')
  const [profile, setProfile] = useState({ id: null, name: '', description: '', email: '', phone: '', avatarUrl: '', coverUrl: '' })
  const [demands, setDemands] = useState([])
  const [newDemand, setNewDemand] = useState({ title: '', description: '', image: '', type: 'Itens', classification: 'pontual' })
  const [showDemandForm, setShowDemandForm] = useState(false)
  const [editingDemand, setEditingDemand] = useState(null)
  const [notice, setNotice] = useState('')
  const [profileStatus, setProfileStatus] = useState({ type: '', message: '' })

  useEffect(() => {
    async function loadProfile() {
      try {
        const sessionResponse = await fetch(`${apiBaseUrl}/api/sessao`, { credentials: 'include' })
        const session = sessionResponse.ok ? await sessionResponse.json() : null
        if (session?.perfil !== 'instituicao') return setAccess('denied')

        const profileResponse = await fetch(`${apiBaseUrl}/api/minha-instituicao`, { credentials: 'include' })
        if (!profileResponse.ok) return setAccess('denied')
        const institution = await profileResponse.json()
        const demandsResponse = await fetch(`${apiBaseUrl}/api/minha-instituicao/demandas`, { credentials: 'include' })
        if (!demandsResponse.ok) throw new Error('Não foi possível carregar as demandas.')

        const savedDemands = await demandsResponse.json()
        setProfile({ id: institution.id, name: institution.nome, description: institution.descricao || '', email: institution.email, phone: institution.telefone || '', avatarUrl: institution.foto_perfil_url || '', coverUrl: institution.foto_capa_url || '' })
        setDemands(savedDemands.map(formatDemand))
        setAccess('granted')
      } catch {
        setAccess('denied')
      }
    }

    loadProfile()
  }, [])

  async function logout() {
    try {
      await fetch(`${apiBaseUrl}/api/logout`, { method: 'POST', credentials: 'include' })
    } finally {
      window.location.href = '/login'
    }
  }

  async function saveProfile(event) {
    event.preventDefault()
    const wordCount = profile.description.trim().split(/\s+/).filter(Boolean).length
    if (wordCount >= 500) {
      setProfileStatus({ type: 'error', message: 'A descrição deve ter menos de 500 palavras.' })
      return
    }

    try {
      const response = await fetch(`${apiBaseUrl}/api/instituicoes/${profile.id}`, {
        method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: profile.name, descricao: profile.description, email: profile.email, telefone: profile.phone, fotoPerfilUrl: profile.avatarUrl, fotoCapaUrl: profile.coverUrl }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message)
      setProfileStatus({ type: 'success', message: 'Perfil atualizado com sucesso.' })
    } catch (error) {
      setProfileStatus({ type: 'error', message: error.message || 'Não foi possível salvar o perfil.' })
    }
  }

  function resetDemandForm() {
    setNewDemand({ title: '', description: '', image: '', type: 'Itens', classification: 'pontual' })
    setEditingDemand(null)
  }

  async function loadDemands() {
    const response = await fetch(`${apiBaseUrl}/api/minha-instituicao/demandas`, { credentials: 'include' })
    const data = response.ok ? await response.json() : null
    if (!response.ok) throw new Error(data?.message || 'Não foi possível carregar as demandas.')
    setDemands(data.map(formatDemand))
  }

  function startNewDemand() {
    resetDemandForm()
    setShowDemandForm(true)
  }

  function closeDemandForm() {
    setShowDemandForm(false)
    resetDemandForm()
  }

  function startEditingDemand(demand) {
    setEditingDemand(demand)
    setNewDemand({ title: demand.title, description: demand.description, image: demand.image === defaultDemandImage ? '' : demand.image, type: demand.type, classification: demand.classification })
    setShowDemandForm(true)
  }

  async function saveDemand(event) {
    event.preventDefault()
    if (!newDemand.title.trim() || !newDemand.description.trim()) return

    const body = {
      titulo: newDemand.title.trim(),
      descricao: newDemand.description.trim(),
      imagem_url: newDemand.image.trim(),
      tipo: newDemand.type === 'Dinheiro' ? 'dinheiro' : 'item',
      classificacao: newDemand.classification,
    }

    try {
      const response = await fetch(
        editingDemand ? `${apiBaseUrl}/api/demandas/${editingDemand.id}` : `${apiBaseUrl}/api/instituicoes/${profile.id}/demandas`,
        {
          method: editingDemand ? 'PUT' : 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editingDemand ? { ...body, status: editingDemand.status === 'Pausada' ? 'pausada' : 'ativa' } : body),
        },
      )
      const data = response.status === 204 ? null : await response.json()
      if (!response.ok) throw new Error(data?.message)

      await loadDemands()
      setShowDemandForm(false)
      resetDemandForm()
      setNotice(editingDemand ? 'Demanda atualizada com sucesso.' : 'Nova demanda publicada com sucesso.')
    } catch (error) {
      setNotice(error.message || 'Não foi possível salvar a demanda.')
    }
  }

  async function toggleDemandStatus(demand) {
    try {
      const response = await fetch(`${apiBaseUrl}/api/demandas/${demand.id}`, {
        method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titulo: demand.title, descricao: demand.description, imagem_url: demand.image === defaultDemandImage ? '' : demand.image, tipo: demand.type === 'Dinheiro' ? 'dinheiro' : 'item', classificacao: demand.classification, status: demand.status === 'Ativa' ? 'pausada' : 'ativa' }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message)
      await loadDemands()
      setNotice(demand.status === 'Ativa' ? 'Demanda pausada.' : 'Demanda reativada.')
    } catch (error) {
      setNotice(error.message || 'Não foi possível atualizar a demanda.')
    }
  }

  async function deleteDemand(demand) {
    if (!window.confirm(`Excluir a demanda “${demand.title}”?`)) return

    try {
      const response = await fetch(`${apiBaseUrl}/api/demandas/${demand.id}`, { method: 'DELETE', credentials: 'include' })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message)
      }
      await loadDemands()
      setNotice('Demanda excluída com sucesso.')
    } catch (error) {
      setNotice(error.message || 'Não foi possível excluir a demanda.')
    }
  }

  if (access === 'checking') return <main className="access-state">Verificando acesso…</main>
  if (access === 'denied') return <main className="access-state"><h1>Acesso restrito</h1><p>Entre com uma conta de instituição para abrir este painel.</p><a href="/login">Ir para o login</a></main>

  return (
    <main className="institution-profile-page">
      <header className="profile-header"><a className="brand" href="/" aria-label="Laço, voltar à página inicial"><span><HeartIcon /></span>laço</a><nav><a href="/">Ver página inicial</a><button className="profile-exit" type="button" onClick={logout}>Sair do painel</button></nav></header>
      <section className="profile-hero">{profile.coverUrl && <img className="profile-cover-image" src={profile.coverUrl} alt="" />}<div className="profile-cover-pattern" /><div className="profile-summary">{profile.avatarUrl ? <img className="institution-avatar" src={profile.avatarUrl} alt="" /> : <div className="institution-monogram">{initialsFromName(profile.name)}</div>}<div><p className="eyebrow"><span className="live-dot" /> PERFIL VALIDADO</p><h1>{profile.name}</h1><p>{profile.description || 'Conte a comunidade sobre a sua causa.'}</p></div></div></section>
      <section className="profile-workspace">
        <aside className="profile-sidebar"><p className="eyebrow">PAINEL DA INSTITUIÇÃO</p><a className={!isEditingProfile ? 'sidebar-active' : ''} href="/instituicoes/perfil">Visão geral</a><a href={`/instituicoes/${profile.id}`}>Perfil público</a><a className={isEditingProfile ? 'sidebar-active' : ''} href="/instituicoes/perfil/editar">Editar perfil</a><a href="/instituicoes/perfil#demandas">Demandas</a><div className="profile-tip"><strong>Seu perfil é público</strong><p>Mantenha sua descrição atualizada para que mais pessoas conheçam sua causa.</p></div></aside>
        <div className="profile-content">
          {isEditingProfile ? <section id="editar-perfil" className="profile-editor"><div className="section-title"><div><p className="eyebrow">EDITAR PERFIL</p><h2>Informações públicas</h2></div><a className="back-to-profile" href="/instituicoes/perfil">← Voltar</a></div><form className="profile-form" onSubmit={saveProfile}><div className="profile-fields"><label>Nome da instituição<input value={profile.name} readOnly aria-readonly="true" /><small>Este nome é definido no cadastro da instituição.</small></label><label>Foto de perfil <span>(URL opcional)</span><input type="url" value={profile.avatarUrl} onChange={(event) => setProfile({ ...profile, avatarUrl: event.target.value })} placeholder="https://..." /></label><label className="full-profile-field">Foto de capa <span>(URL opcional)</span><input type="url" value={profile.coverUrl} onChange={(event) => setProfile({ ...profile, coverUrl: event.target.value })} placeholder="https://..." /></label><label className="full-profile-field">Descrição pública <span>({profile.description.trim().split(/\s+/).filter(Boolean).length}/499 palavras)</span><textarea value={profile.description} onChange={(event) => setProfile({ ...profile, description: event.target.value })} rows="6" placeholder="Conte brevemente sobre sua instituição, sua causa e o impacto que busca gerar." /></label></div>{profileStatus.message && <p className={`profile-status ${profileStatus.type}`} role="status">{profileStatus.message}</p>}<button className="save-profile" type="submit">Salvar perfil</button></form></section> : <section id="perfil" className="profile-preview"><div className="section-title"><div><p className="eyebrow">PERFIL PÚBLICO</p><h2>Como sua instituição aparece</h2></div><div className="profile-preview-actions"><a className="view-public-profile" href={`/instituicoes/${profile.id}`}>Ver perfil público</a><a className="edit-profile-button" href="/instituicoes/perfil/editar">Editar perfil</a></div></div><div className="profile-preview-body">{profile.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : <span className="profile-preview-monogram">{initialsFromName(profile.name)}</span>}<div><h3>{profile.name}</h3><p>{profile.description || 'Sua instituição ainda não adicionou uma descrição pública.'}</p></div></div></section>}
          {!isEditingProfile && <section id="demandas" className="demands-manager"><div className="section-title"><div><p className="eyebrow">O QUE VOCÊ PRECISA</p><h2>Gerencie suas demandas</h2><p>Crie demandas claras para que doadores saibam como ajudar.</p></div><button type="button" className="new-demand-button" onClick={showDemandForm ? closeDemandForm : startNewDemand}>{showDemandForm ? 'Cancelar' : '+ Nova demanda'}</button></div>
            {showDemandForm && <form className="demand-form" onSubmit={saveDemand}><p className="demand-form-title">{editingDemand ? 'Editar demanda' : 'Nova demanda'}</p><label>Título da demanda <b>*</b><input required value={newDemand.title} onChange={(event) => setNewDemand({ ...newDemand, title: event.target.value })} placeholder="Ex.: Kits de alimentação" /></label><label>Tipo de doação<select value={newDemand.type} onChange={(event) => setNewDemand({ ...newDemand, type: event.target.value })}><option>Itens</option><option>Dinheiro</option></select></label><label>Classificação<select value={newDemand.classification} onChange={(event) => setNewDemand({ ...newDemand, classification: event.target.value })}><option value="pontual">Pontual</option><option value="urgente">Urgente</option><option value="mensal">Fixa mensal</option></select></label><label className="wide-field">Descrição <b>*</b><textarea required rows="3" value={newDemand.description} onChange={(event) => setNewDemand({ ...newDemand, description: event.target.value })} placeholder="Explique o que é necessário e como isso ajudará." /></label><label className="wide-field">URL da imagem <span>(opcional)</span><input type="url" value={newDemand.image} onChange={(event) => setNewDemand({ ...newDemand, image: event.target.value })} placeholder="https://..." /></label><button className="publish-demand" type="submit">{editingDemand ? 'Salvar alterações' : 'Publicar demanda'} <span>→</span></button></form>}
            {notice && <p className="dashboard-notice" role="status">{notice}</p>}
            <div className="managed-demands">{demands.length ? demands.map((demand) => <article className="managed-demand" key={demand.id}><img src={demand.image} alt="" /><div className="managed-demand-copy"><div className="demand-meta"><span className={`demand-status ${demand.status === 'Ativa' ? 'active' : 'paused'}`}>{demand.status}</span><span className={`demand-classification ${demand.classification}`}>{demand.classificationLabel}</span><span>{demand.type}</span></div><h3>{demand.title}</h3><p>{demand.description}</p><div className="demand-actions"><button type="button" onClick={() => startEditingDemand(demand)}>Editar</button><button type="button" onClick={() => toggleDemandStatus(demand)}>{demand.status === 'Ativa' ? 'Pausar' : 'Reativar'}</button><button type="button" className="delete-demand" onClick={() => deleteDemand(demand)}>Excluir</button></div></div></article>) : <p className="empty-demands">Ainda não há demandas publicadas. Crie a primeira para que doadores saibam como ajudar.</p>}</div>
          </section>}
        </div>
      </section>
    </main>
  )
}

function DonationInterestButton({ demandId }) {
  const [status, setStatus] = useState({ type: '', message: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function registerInterest() {
    setIsSubmitting(true)
    setStatus({ type: '', message: '' })
    try {
      const sessionResponse = await fetch(`${apiBaseUrl}/api/sessao`, { credentials: 'include' })
      const session = sessionResponse.ok ? await sessionResponse.json() : null
      if (!session) {
        window.location.href = `/login?retorno=${encodeURIComponent(window.location.pathname)}`
        return
      }
      if (session.perfil !== 'usuario') throw new Error('Entre com uma conta de usuário para registrar seu interesse.')

      const response = await fetch(`${apiBaseUrl}/api/demandas/${demandId}/interesses`, { method: 'POST', credentials: 'include' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message)
      setStatus({ type: 'success', message: data.message })
    } catch (error) {
      setStatus({ type: 'error', message: error.message || 'Não foi possível registrar seu interesse.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return <div className="donation-interest"><button type="button" onClick={registerInterest} disabled={isSubmitting}>{isSubmitting ? 'Registrando…' : 'Quero ajudar'} <span>→</span></button>{status.message && <small className={status.type}>{status.message}</small>}</div>
}

function UserProfilePage() {
  const [access, setAccess] = useState('checking')
  const [profile, setProfile] = useState({ name: '', email: '', phone: '', cep: '' })
  const [donations, setDonations] = useState([])
  const [status, setStatus] = useState({ type: '', message: '' })

  useEffect(() => {
    async function loadDashboard() {
      try {
        const sessionResponse = await fetch(`${apiBaseUrl}/api/sessao`, { credentials: 'include' })
        const session = sessionResponse.ok ? await sessionResponse.json() : null
        if (session?.perfil !== 'usuario') return setAccess('denied')

        const [profileResponse, donationsResponse] = await Promise.all([
          fetch(`${apiBaseUrl}/api/meu-perfil`, { credentials: 'include' }),
          fetch(`${apiBaseUrl}/api/minhas-doacoes`, { credentials: 'include' }),
        ])
        if (!profileResponse.ok || !donationsResponse.ok) return setAccess('denied')
        const savedProfile = await profileResponse.json()
        setProfile({ name: savedProfile.nome, email: savedProfile.email, phone: savedProfile.telefone || '', cep: savedProfile.cep_localizacao || '' })
        setDonations(await donationsResponse.json())
        setAccess('granted')
      } catch {
        setAccess('denied')
      }
    }
    loadDashboard()
  }, [])

  async function saveProfile(event) {
    event.preventDefault()
    try {
      const response = await fetch(`${apiBaseUrl}/api/meu-perfil`, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: profile.name, email: profile.email, telefone: profile.phone, cep: profile.cep }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message)
      setStatus({ type: 'success', message: 'Informações atualizadas com sucesso.' })
    } catch (error) {
      setStatus({ type: 'error', message: error.message || 'Não foi possível salvar suas informações.' })
    }
  }

  async function logout() {
    try {
      await fetch(`${apiBaseUrl}/api/logout`, { method: 'POST', credentials: 'include' })
    } finally {
      window.location.href = '/login'
    }
  }

  if (access === 'checking') return <main className="access-state">Carregando seu espaço…</main>
  if (access === 'denied') return <main className="access-state"><h1>Acesso restrito</h1><p>Entre com uma conta de usuário para acessar seu perfil.</p><a href="/login">Ir para o login</a></main>

  const institutions = [...new Map(donations.map((donation) => [donation.instituicao_id, donation])).values()]
  const formatDate = (date) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(`${date}Z`))

  return (
    <main className="user-profile-page">
      <header className="profile-header"><a className="brand" href="/" aria-label="Laço, voltar à página inicial"><span><HeartIcon /></span>laço</a><nav><a href="/">Encontrar causas</a><button className="profile-exit" type="button" onClick={logout}>Sair</button></nav></header>
      <section className="user-profile-hero"><div className="user-profile-monogram">{initialsFromName(profile.name)}</div><div><p className="eyebrow"><span className="live-dot" /> PERFIL DE DOADOR</p><h1>Olá, {profile.name.split(' ')[0]}.</h1><p>Veja as causas que você escolheu apoiar e mantenha seus dados atualizados.</p></div></section>
      <section className="user-profile-content">
        <section className="user-editor"><div className="section-title"><div><p className="eyebrow">SEUS DADOS</p><h2>Informações básicas</h2></div></div><form className="user-profile-form" onSubmit={saveProfile}><label>Nome completo<input value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} required /></label><label>E-mail<input type="email" value={profile.email} onChange={(event) => setProfile({ ...profile, email: event.target.value })} required /></label><label>Telefone<input type="tel" value={profile.phone} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} placeholder="(00) 00000-0000" /></label><label>CEP <span>Usado somente para localização aproximada.</span><input value={profile.cep} onChange={(event) => setProfile({ ...profile, cep: event.target.value })} inputMode="numeric" pattern="[0-9]{5}-?[0-9]{3}" required /></label>{status.message && <p className={`profile-status ${status.type}`} role="status">{status.message}</p>}<button className="save-profile" type="submit">Salvar informações</button></form></section>
        <section className="user-history"><div className="section-title"><div><p className="eyebrow">SEU IMPACTO</p><h2>Histórico de ajudas</h2><p>{donations.length} {donations.length === 1 ? 'interesse registrado' : 'interesses registrados'} · {institutions.length} {institutions.length === 1 ? 'instituição apoiada' : 'instituições apoiadas'}</p></div></div>{donations.length ? <div className="donation-history-list">{donations.map((donation) => <article className="donation-history-item" key={donation.id}><span className="history-icon">♥</span><div><p>{donation.instituicao_nome}</p><h3>{donation.demanda_titulo}</h3><small>{donation.demanda_tipo} · {demandClassificationLabels[donation.demanda_classificacao] || 'Pontual'} · {formatDate(donation.data_registro)}</small></div><span className="interest-status">Interesse enviado</span></article>)}</div> : <p className="empty-demands">Você ainda não registrou interesse em uma demanda. Explore instituições e encontre uma causa para apoiar.</p>}<div className="helped-institutions"><h3>Instituições que você ajudou</h3>{institutions.length ? <div>{institutions.map((donation) => <a key={donation.instituicao_id} href={`/instituicoes/${donation.instituicao_id}`}>{donation.instituicao_nome} <span>→</span></a>)}</div> : <p>As instituições que você apoiar aparecerão aqui.</p>}</div></section>
      </section>
    </main>
  )
}

function PublicInstitutionPage({ institutionId }) {
  const [state, setState] = useState({ status: 'loading', institution: null, demands: [] })

  useEffect(() => {
    const controller = new AbortController()

    async function loadInstitution() {
      try {
        const [institutionResponse, demandsResponse] = await Promise.all([
          fetch(`${apiBaseUrl}/api/instituicoes/${encodeURIComponent(institutionId)}`, { signal: controller.signal }),
          fetch(`${apiBaseUrl}/api/instituicoes/${encodeURIComponent(institutionId)}/demandas`, { signal: controller.signal }),
        ])
        const institution = institutionResponse.ok ? await institutionResponse.json() : null
        const demands = demandsResponse.ok ? await demandsResponse.json() : []
        if (!institutionResponse.ok) throw new Error(institution?.message || 'Instituição não encontrada.')

        setState({ status: 'ready', institution, demands: demands.map(formatDemand) })
      } catch (error) {
        if (error.name !== 'AbortError') setState({ status: 'error', institution: null, demands: [] })
      }
    }

    loadInstitution()
    return () => controller.abort()
  }, [institutionId])

  if (state.status === 'loading') return <main className="access-state">Carregando instituição…</main>
  if (state.status === 'error') return <main className="access-state"><h1>Instituição não encontrada</h1><p>Ela pode não estar mais disponível na plataforma.</p><a href="/">Voltar para as instituições</a></main>

  const { institution, demands } = state
  const location = [institution.cidade, institution.estado].filter(Boolean).join(' · ')

  return (
    <main className="institution-public-page">
      <header className="discovery-nav"><a className="brand" href="/" aria-label="Laço, página inicial"><span><HeartIcon /></span>laço</a><nav><a href="/">Início</a><a href="/mapa">Mapa</a><AccountNavigation /></nav></header>
      <section className="profile-hero public-institution-hero">{institution.foto_capa_url && <img className="profile-cover-image" src={institution.foto_capa_url} alt="" />}<div className="profile-cover-pattern" /><div className="profile-summary">{institution.foto_perfil_url ? <img className="institution-avatar" src={institution.foto_perfil_url} alt="" /> : <div className="institution-monogram">{initialsFromName(institution.nome)}</div>}<div><p className="eyebrow"><span className="live-dot" /> INSTITUIÇÃO VERIFICADA</p><h1>{institution.nome}</h1>{location && <p className="public-location"><PinIcon /> {location}</p>}</div></div></section>
      <section className="public-institution-content">
        <section className="public-about"><p className="eyebrow">SOBRE A INSTITUIÇÃO</p><h2>Conheça a causa</h2><p>{institution.descricao || 'Esta instituição ainda não adicionou uma descrição pública.'}</p></section>
        <section className="public-demands"><div className="section-header"><div><p className="eyebrow">FORMAS DE AJUDAR</p><h2>Demandas atuais</h2></div><p className="section-description">As doações são combinadas diretamente com a instituição. A plataforma não processa pagamentos.</p></div><div className="public-demand-grid">{demands.length ? demands.map((demand) => <article className="public-demand-card" key={demand.id}><img src={demand.image} alt="" /><div><div className="public-demand-badges"><span className="demand-donation-type">{demand.type}</span><span className={`demand-classification ${demand.classification}`}>{demand.classificationLabel}</span></div><h3>{demand.title}</h3><p>{demand.description}</p><DonationInterestButton demandId={demand.id} /></div></article>) : <p className="empty-demands">Esta instituição não possui demandas ativas no momento.</p>}</div></section>
      </section>
    </main>
  )
}

function HomePage({ organizations }) {
  const [isHowItWorksOpen, setIsHowItWorksOpen] = useState(false)
  const [canGoBack, setCanGoBack] = useState(false)
  const [canGoForward, setCanGoForward] = useState(true)
  const nearbyTrackRef = useRef(null)

  useEffect(() => {
    function updateCarouselControls() {
      const track = nearbyTrackRef.current
      if (!track) return
      setCanGoBack(track.scrollLeft > 8)
      setCanGoForward(track.scrollLeft + track.clientWidth < track.scrollWidth - 8)
    }
    const frame = requestAnimationFrame(updateCarouselControls)
    window.addEventListener('resize', updateCarouselControls)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', updateCarouselControls)
    }
  }, [])

  function showNextNearbyOrganizations() {
    const track = nearbyTrackRef.current
    const firstCard = track?.querySelector('.near-organization-card')
    if (!track || !firstCard) return
    const distance = firstCard.offsetWidth + 13
    track.scrollBy({ left: distance, behavior: 'smooth' })
  }

  function showPreviousNearbyOrganizations() {
    const track = nearbyTrackRef.current
    const firstCard = track?.querySelector('.near-organization-card')
    if (!track || !firstCard) return
    track.scrollBy({ left: -(firstCard.offsetWidth + 13), behavior: 'smooth' })
  }

  return (
    <main className={`discovery-home ${isHowItWorksOpen ? 'how-it-works-open' : ''}`}>
      <header className="discovery-nav">
        <a className="brand" href="/" aria-label="Laço, página inicial"><span><HeartIcon /></span>laço</a>
        <nav aria-label="Navegação principal">
          <a href="#como-funciona" onClick={(event) => { event.preventDefault(); setIsHowItWorksOpen(true) }}>Como funciona</a>
          <a href="/mapa">Explorar mapa</a>
          <AccountNavigation />
        </nav>
      </header>

      <section className="discovery-hero">
        <div><p className="eyebrow"><span className="live-dot" /> CONEXÕES QUE TRANSFORMAM</p><h1>Uma causa perto de você precisa de <em>um gesto.</em></h1><p>Encontre instituições verificadas, conheça suas demandas e escolha como apoiar.</p><div className="hero-actions"><a href="#instituicoes" className="primary-action">Conhecer instituições <span>↓</span></a><a href="/mapa" className="map-action"><PinIcon /> Ver todas no mapa</a></div></div>
        
      </section>

      <section className="nearby-section"><div className="section-header"><div><p className="eyebrow">NA SUA REGIÃO</p><h2>Instituições mais próximas</h2></div><a href="/mapa">Abrir mapa <span>↗</span></a></div><div className={`nearby-carousel ${canGoBack ? 'has-previous' : ''} ${canGoForward ? 'has-next' : ''}`}><div className="nearby-track" ref={nearbyTrackRef} onScroll={(event) => { const track = event.currentTarget; setCanGoBack(track.scrollLeft > 8); setCanGoForward(track.scrollLeft + track.clientWidth < track.scrollWidth - 8) }}>{organizations.map((organization) => <NearOrganizationCard key={organization.id} organization={organization} />)}</div>{canGoBack && <button className="nearby-more carousel-previous" type="button" onClick={showPreviousNearbyOrganizations} aria-label="Instituição anterior"><img src={carouselArrow} alt="" /></button>}{canGoForward && <button className="nearby-more carousel-next" type="button" onClick={showNextNearbyOrganizations} aria-label="Próxima instituição"><img src={carouselArrow} alt="" /></button>}</div></section>

      <section id="instituicoes" className="all-institutions-section"><div className="section-header"><div><p className="eyebrow">INSTITUIÇÕES VERIFICADAS</p><h2>Encontre a causa que faz sentido para você</h2></div><p className="section-description">Conheça organizações cadastradas, suas áreas de atuação e demandas atuais.</p></div><div className="expanded-organization-list">{organizations.map((organization) => <ExpandedOrganizationCard key={organization.id} organization={organization} />)}</div></section>
      {isHowItWorksOpen && <><div className="dialog-backdrop" onClick={() => setIsHowItWorksOpen(false)} /><HowItWorksCard onClose={() => setIsHowItWorksOpen(false)} /></>}
    </main>
  )
}

function GoogleMap({ organizations, selectedOrganization }) {
  const containerRef = useRef(null)
  const [message, setMessage] = useState('Carregando mapa…')

  useEffect(() => {
    let isActive = true

    async function initializeMap() {
      try {
        const response = await fetch(`${apiBaseUrl}/api/mapa/config`)
        const configuration = await response.json()
        if (!response.ok || !configuration.mapsApiKey) throw new Error(configuration.message || 'Não foi possível configurar o mapa.')

        await loadGoogleMaps(configuration.mapsApiKey)
        if (!isActive || !containerRef.current) return

        const map = new window.google.maps.Map(containerRef.current, {
          center: { lat: -16.7286, lng: -43.8580 },
          zoom: 12,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
        })
        const selectedInstitution = organizations.find((organization) => organization.id === selectedOrganization && organization.position)

        if (!isActive) return
        if (selectedInstitution) {
          new window.google.maps.Marker({ map, position: selectedInstitution.position, title: selectedInstitution.name })
          map.setCenter(selectedInstitution.position)
          map.setZoom(15)
        }
        setMessage('')
      } catch (error) {
        if (isActive) setMessage(error.message || 'Não foi possível carregar o mapa.')
      }
    }

    initializeMap()
    return () => { isActive = false }
  }, [organizations, selectedOrganization])

  return <div className="standalone-map google-map" aria-label="Mapa com organizações cadastradas"><div className="google-map-canvas" ref={containerRef} />{message && <p className="google-map-status" role="status">{message}</p>}{!message && <div className="map-caption"><PinIcon /> Localizações aproximadas</div>}</div>
}

function MapPage({ organizations }) {
  const [selectedOrganization, setSelectedOrganization] = useState(() => new URLSearchParams(window.location.search).get('instituicao'))

  function selectOrganization(organizationId) {
    setSelectedOrganization(organizationId)
    window.history.replaceState(null, '', `/mapa?instituicao=${organizationId}`)
  }
  return (
    <main className="map-page">
      <header className="discovery-nav"><a className="brand" href="/" aria-label="Laço, página inicial"><span><HeartIcon /></span>laço</a><nav><a href="/">Início</a><AccountNavigation /></nav></header>
      <section className="map-page-intro"><div><p className="eyebrow"><span className="live-dot" /> EXPLORAR INSTITUIÇÕES</p><h1>Veja as causas que estão perto de <em>você.</em></h1></div><p>As localizações são aproximadas para preservar a privacidade das organizações e das pessoas atendidas.</p></section>
      <section className="map-explorer"><GoogleMap organizations={organizations} selectedOrganization={selectedOrganization} /><aside className="map-institution-list"><strong>{organizations.length} instituições na região</strong><p>Selecione uma organização para conhecer suas demandas.</p>{organizations.map((organization) => <button className={selectedOrganization === organization.id ? 'map-list-item is-selected' : 'map-list-item'} key={organization.id} type="button" onClick={() => selectOrganization(organization.id)}><span className={`near-avatar ${organization.color}`}>{organization.initials}</span><span><b>{organization.name}</b><small>{organization.category} · {organization.distance}</small></span></button>)}</aside></section>
    </main>
  )
}

function App() {
  const organizations = useOrganizations()
  const pathname = window.location.pathname
  const institutionPublicMatch = window.location.pathname.match(/^\/instituicoes\/([^/]+)$/)

  useEffect(() => {
    const titles = {
      '/cadastro': 'Criar conta',
      '/instituicoes': 'Cadastro de instituição',
      '/instituicoes/perfil': 'Painel da instituição',
      '/instituicoes/perfil/editar': 'Editar perfil da instituição',
      '/usuario/perfil': 'Meu perfil',
      '/login': 'Entrar',
      '/mapa': 'Mapa de instituições',
    }
    const pageTitle = institutionPublicMatch ? 'Perfil da instituição' : (titles[pathname] || 'Conectando doadores e instituições')
    document.title = `${pageTitle} / Laço`
  }, [institutionPublicMatch, pathname])

  if (pathname === '/cadastro') return <UserRegistrationPage />
  if (pathname === '/instituicoes') return <InstitutionRegistrationPage />
  if (pathname === '/instituicoes/perfil') return <InstitutionProfilePage />
  if (pathname === '/instituicoes/perfil/editar') return <InstitutionProfilePage isEditingProfile />
  if (pathname === '/usuario/perfil') return <UserProfilePage />
  if (institutionPublicMatch) return <PublicInstitutionPage institutionId={decodeURIComponent(institutionPublicMatch[1])} />
  if (pathname === '/login') return <LoginPage />
  if (pathname === '/mapa') return <MapPage organizations={organizations} />
  return <HomePage organizations={organizations} />
}

export default App
