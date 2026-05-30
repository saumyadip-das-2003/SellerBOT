import { useEffect, useMemo, useState } from "react"
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore"
import { useTranslation } from "react-i18next"
import { Edit2, Loader2, MapPin, PackagePlus, Search, Trash2, X, Zap } from "lucide-react"
import toast from "react-hot-toast"
import DistrictSelect from "../components/DistrictSelect.jsx"
import { useAuth } from "../context/AuthContext.jsx"
import { districts } from "../data/districts.js"
import { db } from "../firebase/config.js"
import { detectZone } from "../utils/zoneDetector.js"
import { deleteZoneEmbedding, embedAndStoreZone, syncAllZoneEmbeddings } from "../utils/ragOperations.js"

const outsideKeywords = ["outside", "baire", "বাইরে", "gramer", "gram", "village", "গ্রাম", "union", "upazila", "char", "district", "rural", "remote"]
const initialForm = { charge: "", keywords: "", isHomeCity: false, isOutsideBaseCity: false }

function DeliveryZones() {
  const { t } = useTranslation()
  const { currentUser } = useAuth()
  const [zones, setZones] = useState([])
  const [baseDistrict, setBaseDistrict] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingZone, setEditingZone] = useState(null)
  const [selectedDistrict, setSelectedDistrict] = useState(null)
  const [form, setForm] = useState(initialForm)
  const [saving, setSaving] = useState(false)
  const [customerAddress, setCustomerAddress] = useState("")
  const [manualZoneId, setManualZoneId] = useState("")

  useEffect(() => {
    if (!currentUser?.uid) return undefined
    const zonesRef = collection(db, "users", currentUser.uid, "deliveryZones")
    const zonesQuery = query(zonesRef, orderBy("createdAt", "asc"))
    const unsubscribe = onSnapshot(zonesQuery, (snapshot) => {
      setZones(snapshot.docs.map((zoneDoc) => ({ id: zoneDoc.id, ...zoneDoc.data() })))
      setLoading(false)
    }, (error) => {
      toast.error(error.message || "Could not load delivery zones.")
      setLoading(false)
    })
    getDoc(doc(db, "users", currentUser.uid, "settings", "shop")).then((snapshot) => {
      const shop = snapshot.data()
      setBaseDistrict(districts.find((district) => district.name === shop?.baseCity) || null)
    })
    return unsubscribe
  }, [currentUser?.uid])

  const detectedZone = useMemo(() => detectZone(customerAddress, zones), [customerAddress, zones])
  const manualZone = zones.find((zone) => zone.id === manualZoneId) || null
  const activeZone = manualZone || detectedZone
  const homeZone = zones.find((zone) => zone.isHomeCity)
  const outsideZone = zones.find((zone) => zone.isOutsideBaseCity)
  const specificCount = zones.filter((zone) => !zone.isOutsideBaseCity).length

  const openAddModal = () => {
    setEditingZone(null)
    setSelectedDistrict(null)
    setForm(initialForm)
    setIsModalOpen(true)
  }

  const openEditModal = (zone) => {
    setEditingZone(zone)
    setSelectedDistrict(districts.find((district) => district.name === zone.area || zone.area === "Outside " + district.name) || baseDistrict || null)
    setForm({
      charge: String(zone.charge ?? ""),
      keywords: (zone.keywords || []).join(", "),
      isHomeCity: Boolean(zone.isHomeCity),
      isOutsideBaseCity: Boolean(zone.isOutsideBaseCity),
    })
    setIsModalOpen(true)
  }

  const closeModal = () => {
    if (saving) return
    setIsModalOpen(false)
    setEditingZone(null)
    setSelectedDistrict(null)
    setForm(initialForm)
  }

  const handleDistrictSelect = (district) => {
    setSelectedDistrict(district)
    setForm((current) => ({ ...current, keywords: current.isOutsideBaseCity ? buildOutsideKeywords(baseDistrict || district).join(", ") : district.keywords.join(", ") }))
  }

  const handleFormChange = (updater) => {
    setForm((current) => {
      const next = typeof updater === "function" ? updater(current) : updater
      if (next.isOutsideBaseCity && !current.isOutsideBaseCity) {
        return { ...next, isHomeCity: false, keywords: buildOutsideKeywords(baseDistrict || selectedDistrict).join(", "), charge: next.charge || "150" }
      }
      if (next.isHomeCity && !current.isHomeCity) {
        return { ...next, isOutsideBaseCity: false, charge: next.charge || "60" }
      }
      return next
    })
  }

  const handleSave = async (event) => {
    event.preventDefault()
    const district = form.isOutsideBaseCity ? baseDistrict || selectedDistrict : selectedDistrict
    if (!district) {
      toast.error("Select an area district.")
      return
    }
    const charge = Number(form.charge)
    if (!Number.isFinite(charge) || charge < 0) {
      toast.error("Enter a valid delivery charge.")
      return
    }
    if (form.isHomeCity && zones.some((zone) => zone.isHomeCity && zone.id !== editingZone?.id)) {
      toast.error("Only one Home City zone can be active at a time.")
      return
    }
    if (form.isOutsideBaseCity && zones.some((zone) => zone.isOutsideBaseCity && zone.id !== editingZone?.id)) {
      toast.error("Only one Outside Base City catch-all zone can be active at a time.")
      return
    }

    const payload = form.isOutsideBaseCity
      ? {
          area: "Outside " + district.name,
          banglaArea: district.bangla + " এর বাইরে",
          division: district.division,
          charge,
          keywords: splitCommaList(form.keywords),
          isHomeCity: false,
          isOutsideBaseCity: true,
        }
      : {
          area: district.name,
          banglaArea: district.bangla,
          division: district.division,
          charge,
          keywords: splitCommaList(form.keywords),
          isHomeCity: form.isHomeCity,
          isOutsideBaseCity: false,
        }

    try {
      setSaving(true)
      if (editingZone) {
        await updateDoc(doc(db, "users", currentUser.uid, "deliveryZones", editingZone.id), payload)
        await embedAndStoreZone(currentUser.uid, { id: editingZone.id, ...payload })
        toast.success("Delivery zone updated.")
      } else {
        const zoneRef = doc(collection(db, "users", currentUser.uid, "deliveryZones"))
        await setDoc(zoneRef, { ...payload, createdAt: serverTimestamp() })
        await embedAndStoreZone(currentUser.uid, { id: zoneRef.id, ...payload })
        toast.success("Delivery zone added.")
      }
      closeAfterSave()
    } catch (error) {
      toast.error(error.message || "Could not save delivery zone.")
    } finally {
      setSaving(false)
    }
  }

  const closeAfterSave = () => {
    setIsModalOpen(false)
    setEditingZone(null)
    setSelectedDistrict(null)
    setForm(initialForm)
  }

  const handleDelete = async (zone) => {
    if (!window.confirm("Delete " + zone.area + "? This cannot be undone.")) return
    try {
      await deleteDoc(doc(db, "users", currentUser.uid, "deliveryZones", zone.id))
      await deleteZoneEmbedding(currentUser.uid, zone.id)
      toast.success("Delivery zone deleted.")
    } catch (error) {
      toast.error(error.message || "Could not delete delivery zone.")
    }
  }

  const quickSetup = async () => {
    if (!window.confirm("Generate delivery zones for all Bangladesh districts plus Outside Base City?")) return
    try {
      const shopSnapshot = await getDoc(doc(db, "users", currentUser.uid, "settings", "shop"))
      const shop = shopSnapshot.data()
      const homeDistrict = districts.find((district) => district.name === shop?.baseCity)
      if (!homeDistrict) {
        toast.error("Set your shop base district before quick setup.")
        return
      }
      const batch = writeBatch(db)
      const zonesRef = collection(db, "users", currentUser.uid, "deliveryZones")
      const createdZones = []
      districts.forEach((district) => {
        const isHome = district.name === homeDistrict.name
        const charge = isHome ? 60 : district.division === homeDistrict.division ? 100 : 120
        const zoneRef = doc(zonesRef)
        const zonePayload = {
          area: district.name,
          banglaArea: district.bangla,
          division: district.division,
          charge,
          keywords: district.keywords,
          isHomeCity: isHome,
          isOutsideBaseCity: false,
        }
        batch.set(zoneRef, { ...zonePayload, createdAt: serverTimestamp() })
        createdZones.push({ id: zoneRef.id, ...zonePayload })
      })
      const outsideRef = doc(zonesRef)
      const outsidePayload = {
        area: "Outside " + homeDistrict.name,
        banglaArea: homeDistrict.bangla + " এর বাইরে",
        division: homeDistrict.division,
        charge: 150,
        keywords: buildOutsideKeywords(homeDistrict),
        isHomeCity: false,
        isOutsideBaseCity: true,
      }
      batch.set(outsideRef, { ...outsidePayload, createdAt: serverTimestamp() })
      createdZones.push({ id: outsideRef.id, ...outsidePayload })
      await batch.commit()
      setBaseDistrict(homeDistrict)
      const syncResult = await syncAllZoneEmbeddings(currentUser.uid, createdZones)
      toast.success("Delivery zones generated. AI search synced for " + syncResult.succeeded + "/" + syncResult.total + " zones.")
    } catch (error) {
      toast.error(error.message || "Could not run quick setup.")
    }
  }

  return (
    <section className="space-y-6">
      <div className="page-header">
        <div>
          <p className="text-sm font-black uppercase tracking-wide text-[#1D9E75]">{t("zones.title")}</p>
          <h2 className="page-title mt-1">{t("zones.title")}</h2>
          <p className="page-subtitle max-w-3xl">{t("zones.subtitle", { defaultValue: "Configure home city, specific city, and outside base city delivery charges." })}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {!loading && zones.length === 0 && <button className="btn-secondary" type="button" onClick={quickSetup}><Zap className="h-4 w-4" />{t("zones.quickSetup")}</button>}
          <button className="btn-primary" type="button" onClick={openAddModal}><PackagePlus className="h-4 w-4" />{t("zones.addZone")}</button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard title="Total Zones" value={zones.length} detail={zones.length ? specificCount + " district/specific zones" : "No zones yet"} />
        <MetricCard title="Home City" value={homeZone?.area || "Not set"} detail={homeZone ? "৳" + homeZone.charge + " delivery charge" : "Set your base district zone"} />
        <MetricCard title="Outside Catch-all" value={outsideZone?.area || "Not set"} detail={outsideZone ? "৳" + outsideZone.charge + " fallback charge" : "Keeps unmatched addresses covered"} />
      </div>

      <AddressZonePanel address={customerAddress} activeZone={activeZone} detectedZone={detectedZone} manualZoneId={manualZoneId} onAddressChange={setCustomerAddress} onManualChange={setManualZoneId} zones={zones} />

      {loading ? <div className="card flex min-h-52 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#1D9E75]" /></div> : zones.length > 0 ? <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">{zones.map((zone) => <ZoneCard key={zone.id} baseDistrict={baseDistrict} zone={zone} onEdit={openEditModal} onDelete={handleDelete} />)}</div> : <div className="empty-state card"><MapPin className="h-12 w-12 text-[#1D9E75]" /><h3 className="empty-state-title">{t("zones.noZones")}</h3><p className="empty-state-desc">Use quick setup or add a custom delivery zone.</p></div>}

      {isModalOpen && <ZoneModal baseDistrict={baseDistrict} form={form} saving={saving} selectedDistrict={selectedDistrict} onClose={closeModal} onDistrictSelect={handleDistrictSelect} onFormChange={handleFormChange} onSave={handleSave} />}
    </section>
  )
}

function MetricCard({ title, value, detail }) {
  return <div className="stat-card"><p className="stat-label">{title}</p><p className="stat-value break-words text-2xl">{value}</p><p className="stat-sub">{detail}</p></div>
}

function AddressZonePanel({ address, activeZone, detectedZone, manualZoneId, onAddressChange, onManualChange, zones }) {
  return <div className="card"><div className="mb-4 flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#1D9E75]/10 text-[#1D9E75]"><Search className="h-5 w-5" /></div><div><h3 className="text-lg font-black">Address Zone Tester</h3><p className="text-sm" style={{ color: "var(--text-secondary)" }}>Paste an address to preview auto-detection and delivery charge.</p></div></div><div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]"><label className="block"><span>Customer Address</span><textarea className="mt-2 min-h-28" value={address} onChange={(event) => onAddressChange(event.target.value)} placeholder="Paste full address exactly as customer sent it" /></label><div className="space-y-3"><ZoneDetectionMessage zone={detectedZone} /><label className="block"><span>Manual override</span><select className="mt-2" value={manualZoneId} onChange={(event) => onManualChange(event.target.value)}><option value="">Use auto-detected zone</option>{zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.area} - ৳{zone.charge}</option>)}</select></label><div className="rounded-xl px-4 py-3 text-sm" style={{ background: "var(--bg-secondary)" }}><span style={{ color: "var(--text-secondary)" }}>Delivery charge: </span><span className="font-black">{activeZone ? "৳" + activeZone.charge : "Not set"}</span></div></div></div></div>
}

function ZoneDetectionMessage({ zone }) {
  if (!zone) return <p className="alert alert-warning mb-0">Could not detect zone. Select manually.</p>
  if (zone.isFallback) return <p className="alert alert-warning mb-0">No specific area detected. Defaulting to {zone.area}. Please verify.</p>
  return <p className="alert alert-success mb-0">Auto-detected: {zone.area}</p>
}

function ZoneCard({ zone, baseDistrict, onEdit, onDelete }) {
  const keywords = zone.keywords || []
  const previewKeywords = zone.isOutsideBaseCity ? keywords.slice(0, 8) : keywords.slice(0, 6)
  const hiddenCount = Math.max(0, keywords.length - previewKeywords.length)
  const coveredDistrictCount = zone.isOutsideBaseCity && baseDistrict ? districts.filter((district) => district.name !== baseDistrict.name).length : 0

  return (
    <article className="card card-hover flex min-h-64 flex-col justify-between">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="break-words text-xl font-black">{zone.area}</h3>
            <p className="mt-1 text-sm font-bold text-[#1D9E75]">{zone.banglaArea}</p>
            <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>{zone.division}</p>
          </div>
          <div className="flex shrink-0 flex-col gap-2">
            {zone.isHomeCity && <span className="badge badge-green">Home City</span>}
            {zone.isOutsideBaseCity && <span className="badge badge-yellow">Outside {baseDistrict?.name || "Base City"}</span>}
          </div>
        </div>
        <div className="mt-4 rounded-xl px-4 py-3 text-sm" style={{ background: "var(--bg-secondary)" }}><span style={{ color: "var(--text-secondary)" }}>Charge </span><span className="font-black">৳{zone.charge}</span></div>
        {zone.isOutsideBaseCity ? <div className="alert alert-warning mt-4"><div><p className="font-black">Catch-all zone</p><p className="mt-1 text-xs leading-5">Covers unmatched addresses{coveredDistrictCount ? " and " + coveredDistrictCount + " districts outside " + baseDistrict?.name : " outside your base city"}.</p></div></div> : null}
        <div className="mt-4"><p className="text-xs font-black uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>Keyword preview</p><div className="mt-2 flex max-h-20 flex-wrap gap-2 overflow-hidden">{previewKeywords.map((keyword) => <span key={keyword} className="badge badge-gray">{keyword}</span>)}{hiddenCount > 0 && <span className="badge badge-primary">+{hiddenCount} more</span>}</div></div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3"><button className="btn-secondary btn-sm" type="button" onClick={() => onEdit(zone)}><Edit2 className="h-4 w-4" />Edit</button><button className="btn-danger btn-sm" type="button" onClick={() => onDelete(zone)}><Trash2 className="h-4 w-4" />Delete</button></div>
    </article>
  )
}

function ZoneModal({ baseDistrict, form, saving, selectedDistrict, onClose, onDistrictSelect, onFormChange, onSave }) {
  return <div className="modal-overlay"><section className="modal max-w-2xl"><div className="modal-header"><h3 className="modal-title">Delivery Zone</h3><button className="btn-ghost btn-icon" type="button" onClick={onClose} disabled={saving} aria-label="Close zone modal"><X className="h-5 w-5" /></button></div><form className="space-y-5" onSubmit={onSave}>{!form.isOutsideBaseCity && <DistrictSelect label="Area Name" selectedDistrict={selectedDistrict} onSelect={onDistrictSelect} disabled={saving} />}{form.isOutsideBaseCity && <p className="alert alert-warning">Outside zone will be saved as Outside {baseDistrict?.name || selectedDistrict?.name || "Base City"}</p>}<label className="block"><span>Delivery Charge (৳)</span><input className="mt-2" type="number" min="0" value={form.charge} onChange={(event) => onFormChange((current) => ({ ...current, charge: event.target.value }))} disabled={saving} /></label><label className="block"><span>Keywords</span><input className="mt-2" value={form.keywords} onChange={(event) => onFormChange((current) => ({ ...current, keywords: event.target.value }))} disabled={saving} /></label><label className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold" style={{ background: "var(--bg-secondary)", color: "var(--text-primary)" }}><input className="h-4 w-4 accent-[#1D9E75]" type="checkbox" checked={form.isHomeCity} onChange={(event) => onFormChange((current) => ({ ...current, isHomeCity: event.target.checked }))} disabled={saving} />Is this your Home City?</label><label className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold" style={{ background: "var(--warning-bg)", color: "var(--warning)" }}><input className="h-4 w-4 accent-[#f39c12]" type="checkbox" checked={form.isOutsideBaseCity} onChange={(event) => onFormChange((current) => ({ ...current, isOutsideBaseCity: event.target.checked }))} disabled={saving} />Is this Outside {baseDistrict?.name || "BaseCity"} catch-all?</label><div className="flex justify-end gap-3 border-t pt-5" style={{ borderColor: "var(--border)" }}><button className="btn-secondary" type="button" onClick={onClose} disabled={saving}>Cancel</button><button className="btn-primary" type="submit" disabled={saving}>{saving ? "Saving..." : "Save Zone"}</button></div></form></section></div>
}

function buildOutsideKeywords(baseDistrict) {
  const baseName = baseDistrict?.name
  const remainingDistrictKeywords = districts
    .filter((district) => district.name !== baseName)
    .flatMap((district) => [district.name, district.bangla, ...(district.keywords || [])])
  return Array.from(new Set([...outsideKeywords, ...remainingDistrictKeywords].filter(Boolean)))
}

function splitCommaList(value) {
  return value.split(",").map((item) => item.trim()).filter(Boolean)
}

export default DeliveryZones
