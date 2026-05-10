import { useState } from "react"
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth"
import { Bot, Loader2, LockKeyhole, Mail } from "lucide-react"
import toast from "react-hot-toast"
import { Navigate, useLocation, useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext.jsx"
import { auth } from "../firebase/config.js"

function Login() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [authMode, setAuthMode] = useState(null)
  const { currentUser, loading } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const redirectTo = location.state?.from?.pathname || "/dashboard"
  const isAuthenticating = Boolean(authMode)

  if (!loading && currentUser) {
    return <Navigate to="/dashboard" replace />
  }

  const handleAuth = async (mode) => {
    if (!email.trim() || !password) {
      toast.error("Enter your email and password.")
      return
    }

    try {
      setAuthMode(mode)

      if (mode === "login") {
        await signInWithEmailAndPassword(auth, email.trim(), password)
        toast.success("Welcome back to SellerBot.")
      } else {
        await createUserWithEmailAndPassword(auth, email.trim(), password)
        toast.success("Account created successfully.")
      }

      navigate(redirectTo, { replace: true })
    } catch (error) {
      toast.error(getAuthErrorMessage(error))
    } finally {
      setAuthMode(null)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 text-slate-950">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-[#1D9E75] text-white">
            <Bot className="h-7 w-7" aria-hidden="true" />
          </div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[#1D9E75]">
            SellerBot
          </p>
          <h1 className="mt-2 text-3xl font-semibold">Seller Login</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Access your AI-powered POS workspace for Facebook and WhatsApp sales.
          </p>
        </div>

        <form className="space-y-5" onSubmit={(event) => event.preventDefault()}>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Email</span>
            <span className="mt-2 flex items-center gap-3 rounded-md border border-slate-300 bg-white px-3 py-2.5 focus-within:border-[#1D9E75] focus-within:ring-2 focus-within:ring-[#1D9E75]/20">
              <Mail className="h-5 w-5 text-slate-400" aria-hidden="true" />
              <input
                className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="seller@example.com"
                autoComplete="email"
                disabled={isAuthenticating}
              />
            </span>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Password</span>
            <span className="mt-2 flex items-center gap-3 rounded-md border border-slate-300 bg-white px-3 py-2.5 focus-within:border-[#1D9E75] focus-within:ring-2 focus-within:ring-[#1D9E75]/20">
              <LockKeyhole className="h-5 w-5 text-slate-400" aria-hidden="true" />
              <input
                className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                disabled={isAuthenticating}
              />
            </span>
          </label>

          <div className="grid gap-3 pt-2 sm:grid-cols-2">
            <button
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#1D9E75] px-4 text-sm font-semibold text-white transition hover:bg-[#178765] disabled:cursor-not-allowed disabled:opacity-70"
              type="button"
              onClick={() => handleAuth("login")}
              disabled={isAuthenticating}
            >
              {authMode === "login" && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              Login
            </button>
            <button
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
              type="button"
              onClick={() => handleAuth("create")}
              disabled={isAuthenticating}
            >
              {authMode === "create" && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              Create Account
            </button>
          </div>
        </form>
      </section>
    </main>
  )
}

function getAuthErrorMessage(error) {
  switch (error.code) {
    case "auth/email-already-in-use":
      return "An account already exists for this email."
    case "auth/invalid-email":
      return "Enter a valid email address."
    case "auth/invalid-credential":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "Email or password is incorrect."
    case "auth/weak-password":
      return "Use a password with at least 6 characters."
    default:
      return error.message || "Authentication failed. Please try again."
  }
}

export default Login
