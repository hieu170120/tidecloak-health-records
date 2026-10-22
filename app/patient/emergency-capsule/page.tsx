'use client'
import { useTideCloak } from '@tidecloak/nextjs'
import { useEffect, useState } from 'react'
import Link from 'next/link'

const TAG='emergency_capsule'
const empty={bloodType:'',allergies:'',medications:'',conditions:'',emergencyContact:''}
function toBase64(bytes:Uint8Array) {
  let binary=''; for(const b of bytes) binary+=String.fromCharCode(b)
  return btoa(binary)
}
function fromBase64(text:string) {return Uint8Array.from(atob(text),c=>c.charCodeAt(0))}
export default function CapsulePage() {
  const {authenticated,isInitializing,login,hasRealmRole,hasClientRole,getValueFromToken,getToken,secureFetch,doEncrypt,doDecrypt}=useTideCloak()
  const subject=String(getValueFromToken('sub') ?? '')
  const patient=hasRealmRole('PATIENT') || hasClientRole('PATIENT')
  const [sessionOwner,setSessionOwner]=useState('')
  function checkSession() {if(String(getValueFromToken('sub') ?? '')!==subject) throw Error('Phiên đăng nhập đã đổi; tải lại dữ liệu.')}
  const [form,setForm]=useState(empty),[version,setVersion]=useState(0),[ready,setReady]=useState(false)
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[status,setStatus]=useState(''),[audit,setAudit]=useState<any>(null)
  async function api(path:string,method='GET',body?:unknown) {
    checkSession()
    const token=await getToken()
    checkSession()
    if(!token) throw Error('Đăng nhập lại để tiếp tục.')
    const response=await secureFetch(`/api/health/${path}`,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)})
    const data=await response.json()
    checkSession()
    if(!response.ok) throw Error(typeof data.message==='string'?data.message:(data.error ?? `API ${response.status}`))
    return data
  }
  async function load() {
    setBusy(true);setError('');setReady(false);setForm(empty);setAudit(null);setStatus('');setVersion(0);setSessionOwner(subject)
    try {
      await api('me')
      const result=await api('me/emergency-capsule')
      checkSession()
      setVersion(result.latestVersion)
      if(result.capsule) {
        const bytes=fromBase64(result.capsule.ciphertext)
        const value=result.capsule.ciphertextFormat==='TIDE_STRING'?new TextDecoder().decode(bytes):bytes
        const decrypted=await doDecrypt([{encrypted:value,tags:[TAG]}])
        if(!decrypted || decrypted.length!==1) throw Error('Tide không trả dữ liệu giải mã.')
        checkSession()
        const decoded=JSON.parse(typeof decrypted[0]==='string'?decrypted[0]:new TextDecoder().decode(decrypted[0]))
        if(Object.keys(empty).some(k=>typeof decoded[k]!=='string')) throw Error('Định dạng capsule không hợp lệ.')
        setForm(Object.fromEntries(Object.keys(empty).map(k=>[k,decoded[k]])) as typeof empty)
      } else setForm(empty)
      setReady(true)
      setAudit(await api('me/audit'))
    } catch(e){if(String(getValueFromToken('sub') ?? '')!==subject)return;setError(e instanceof Error?e.message:'Không đọc được capsule.')}finally{setBusy(false)}
  }
  useEffect(()=>{setForm(empty);setAudit(null);setReady(false);setStatus('');if(authenticated && patient) void load()},[authenticated,subject,patient])
  async function save() {
    setBusy(true);setError('');setStatus('')
    try {
      const values=await doEncrypt([{data:JSON.stringify(form),tags:[TAG]}])
      checkSession()
      const encrypted=values?.[0]
      if(typeof encrypted!=='string' && !(encrypted instanceof Uint8Array)) throw Error('Tide chưa trả ciphertext hợp lệ.')
      const result=await api('me/emergency-capsule','PUT',{expectedVersion:version,ciphertext:toBase64(typeof encrypted==='string'?new TextEncoder().encode(encrypted):encrypted),ciphertextFormat:typeof encrypted==='string'?'TIDE_STRING':'TIDE_BYTES'})
      setVersion(result.version);setStatus(`Đã lưu phiên bản ${result.version}, kèm audit trong cùng transaction.`)
      setAudit(await api('me/audit'))
    }catch(e){setError(e instanceof Error?e.message:'Không lưu được.')}finally{setBusy(false)}
  }
  async function archive() {
    setBusy(true);setError('')
    try {
      await api('me/emergency-capsule','DELETE',{expectedVersion:version})
      setForm(empty);setStatus('Đã ngừng sử dụng capsule hiện tại; lịch sử ciphertext được giữ lại.')
      setAudit(await api('me/audit'))
    }catch(e){setError(e instanceof Error?e.message:'Không archive được.')}finally{setBusy(false)}
  }
  if(isInitializing) return <main>Đang khởi tạo TideCloak…</main>
  if(!authenticated) return <main><h1>Emergency Capsule</h1><button onClick={()=>void login()}>Đăng nhập TideCloak</button></main>
  if(!patient) return <main><h1>Không có role PATIENT</h1><p>Không tự cấp role từ ứng dụng. Cần role được quản trị TideCloak phê duyệt.</p><Link href="/home">Quay lại</Link></main>
  if(sessionOwner!==subject) return <main>Đang cập nhật phiên đăng nhập…</main>
  return <main style={{maxWidth:760,margin:'40px auto',padding:24,fontFamily:'system-ui'}}>
    <Link href="/home">← Trang chủ</Link><h1>Emergency Capsule cá nhân</h1>
    <p>Chỉ dùng dữ liệu giả lập để demo. Bản này mã hóa dưới identity của chính bạn; chưa chia sẻ cho bác sĩ hoặc Break-Glass.</p>
    <p>Yêu cầu Tide roles: <code>_tide_emergency_capsule.selfencrypt</code> và <code>_tide_emergency_capsule.selfdecrypt</code>.</p>
    {error&&<p role="alert" style={{color:'#b00020'}}>{error}</p>}{status&&<p role="status">{status}</p>}
    <button disabled={busy} onClick={()=>void load()}>Tải lại và giải mã</button>
    <form onSubmit={e=>{e.preventDefault();void save()}}>
      {Object.entries({bloodType:'Nhóm máu',allergies:'Dị ứng',medications:'Thuốc',conditions:'Bệnh nền',emergencyContact:'Liên hệ khẩn cấp'}).map(([key,label])=><label key={key} style={{display:'block',margin:'16px 0'}}>{label}<textarea maxLength={8000} required={key==='bloodType'} value={form[key as keyof typeof form]} onChange={e=>setForm({...form,[key]:e.target.value})} style={{display:'block',width:'100%',minHeight:45}} /></label>)}
      <p>Phiên bản hiện biết: {version}. Ghi đồng thời từ tab khác sẽ yêu cầu tải lại.</p>
      <button disabled={busy||!ready} type="submit">{busy?'Đang xử lý…':'Mã hóa bằng Tide và lưu'}</button>{' '}
      <button disabled={busy||!ready||version===0} type="button" onClick={()=>{if(window.confirm('Archive capsule hiện tại? Lịch sử vẫn được giữ.')) void archive()}}>Archive</button>
    </form>
    <h2>Audit của bạn</h2><p>Chữ ký cục bộ; chưa neo vào kho độc lập. Event trả ciphertext không chứng minh người dùng đã đọc plaintext.</p>
    {audit?.events?.map((entry:any)=><p key={entry.sequence}>{entry.event?.occurredAt} — {entry.event?.action} — chữ ký {entry.signatureValid?'hợp lệ':'không xác minh được'}</p>)}
  </main>
}
