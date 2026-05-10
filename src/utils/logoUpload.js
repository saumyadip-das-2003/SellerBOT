import { doc, serverTimestamp, setDoc } from "firebase/firestore"
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage"
import { db, storage } from "../firebase/config.js"

const maxLogoSize = 2 * 1024 * 1024
const uploadTimeoutMs = 45000

export async function uploadShopLogo(uid, file, onProgress) {
  if (!uid) {
    throw new Error("Please log in before uploading a logo")
  }

  if (!file?.type?.startsWith("image/")) {
    throw new Error("Please select an image file")
  }

  if (file.size > maxLogoSize) {
    throw new Error("Logo must be less than 2MB")
  }

  const bucket = storage.app.options.storageBucket
  if (!bucket) {
    throw new Error("Firebase Storage bucket is not configured")
  }

  const extension = file.name?.split(".").pop()?.toLowerCase() || "png"
  const storageRef = ref(storage, `logos/${uid}/shop-logo.${extension}`)
  const uploadTask = uploadBytesResumable(storageRef, file, { contentType: file.type })

  const snapshot = await waitForUpload(uploadTask, onProgress)
  const downloadURL = await getDownloadURL(snapshot.ref)

  await setDoc(doc(db, "users", uid, "settings", "shop"), {
    logoURL: downloadURL,
    updatedAt: serverTimestamp(),
  }, { merge: true })

  return downloadURL
}

function waitForUpload(uploadTask, onProgress) {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      uploadTask.cancel()
      reject(new Error("Logo upload timed out. Check Firebase Storage rules and try again."))
    }, uploadTimeoutMs)

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const progress = snapshot.totalBytes ? Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100) : 0
        onProgress?.(progress)
      },
      (error) => {
        window.clearTimeout(timer)
        reject(formatStorageError(error))
      },
      () => {
        window.clearTimeout(timer)
        resolve(uploadTask.snapshot)
      },
    )
  })
}

function formatStorageError(error) {
  if (error?.code === "storage/unauthorized") {
    return new Error("Logo upload is blocked by Firebase Storage rules")
  }

  if (error?.code === "storage/canceled") {
    return new Error("Logo upload was canceled")
  }

  if (error?.code === "storage/retry-limit-exceeded") {
    return new Error("Logo upload failed due to network timeout")
  }

  return new Error(error?.message || "Could not upload logo")
}
