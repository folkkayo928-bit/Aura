import React, { useEffect, useState } from 'react';
import { AlertTriangle, ArrowUpRight, Check, Copy, Eye, EyeOff, KeyRound, Loader2, LockKeyhole, RefreshCw, ShieldCheck, Wallet } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  EVM_NETWORKS,
  estimateEvmUsdtTransfer,
  readEvmBalances,
  readEvmTransactionStatus,
  sendEvmUsdt,
  type EvmBalanceSnapshot,
  type EvmNetwork,
  type EvmTransferReview,
  type EvmTransactionStatus,
} from '../../lib/evmClient';
import {
  createRecoveryPhrase,
  getLocalEvmWalletMetadata,
  normalizeRecoveryPhrase,
  storeEncryptedLocalEvmWallet,
  unlockLocalEvmWallet,
  type LocalEvmWalletMetadata,
} from '../../lib/nonCustodialWallet';

type Mode = 'checking' | 'summary' | 'create' | 'import' | 'unlock';

function randomPositions(wordCount: number, count: number): number[] {
  if (!globalThis.crypto?.getRandomValues) throw new Error('Secure randomness is not available in this browser.');
  const selected = new Set<number>();
  while (selected.size < Math.min(count, wordCount)) {
    const value = new Uint32Array(1);
    crypto.getRandomValues(value);
    selected.add(value[0] % wordCount);
  }
  return [...selected].sort((a, b) => a - b);
}

function displayBalance(value: string, maxDecimals = 8): string {
  if (value === '—') return value;
  const [whole, fraction = ''] = value.split('.');
  const visible = fraction.slice(0, maxDecimals).replace(/0+$/, '');
  return visible ? whole + '.' + visible : whole;
}

const TRANSACTION_EXPLORERS: Record<EvmNetwork, string> = {
  ethereum: 'https://etherscan.io/tx/',
  polygon: 'https://polygonscan.com/tx/',
  arbitrum: 'https://arbiscan.io/tx/',
  bsc: 'https://bscscan.com/tx/',
};

export const NonCustodialWalletPanel: React.FC = () => {
  const { user, loading: authLoading, openAuth } = useAuth();
  const [mode, setMode] = useState<Mode>('checking');
  const [metadata, setMetadata] = useState<LocalEvmWalletMetadata | null>(null);
  const [walletMnemonic, setWalletMnemonic] = useState('');
  const [showRecoveryPhrase, setShowRecoveryPhrase] = useState(false);
  const [draftPhrase, setDraftPhrase] = useState('');
  const [importPhrase, setImportPhrase] = useState('');
  const [challengePositions, setChallengePositions] = useState<number[]>([]);
  const [challengeAnswers, setChallengeAnswers] = useState<string[]>(['', '', '']);
  const [backupConfirmed, setBackupConfirmed] = useState(false);
  const [replaceConfirmed, setReplaceConfirmed] = useState(false);
  const [needsReplacement, setNeedsReplacement] = useState(false);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [balances, setBalances] = useState<EvmBalanceSnapshot[]>([]);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceError, setBalanceError] = useState('');
  const [sendNetwork, setSendNetwork] = useState<EvmNetwork>('polygon');
  const [sendDestination, setSendDestination] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [reviewBusy, setReviewBusy] = useState(false);
  const [transferReview, setTransferReview] = useState<EvmTransferReview | null>(null);
  const [sendConfirmed, setSendConfirmed] = useState(false);
  const [sendBusy, setSendBusy] = useState(false);
  const [sendResult, setSendResult] = useState<{
    hash: string;
    network: EvmNetwork;
    amount: string;
    destination: string;
    status: EvmTransactionStatus;
  } | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);

  const refreshBalances = async (addressValue?: string) => {
    const targetAddress = addressValue || metadata?.address;
    if (!targetAddress) return;
    setBalanceLoading(true);
    setBalanceError('');
    try {
      const next = await readEvmBalances(targetAddress);
      setBalances(next);
      if (next.every((item) => !item.available)) {
        setBalanceError('Could not read balances from the current RPC endpoints. No balance has been changed.');
      } else if (next.some((item) => !item.available)) {
        setBalanceError('Some networks are unavailable right now. Balances shown as unavailable must not be treated as zero.');
      }
    } catch (cause) {
      setBalanceError(cause instanceof Error ? cause.message : 'Could not load on-chain balances.');
    } finally {
      setBalanceLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    setMetadata(null);
    setWalletMnemonic('');
    setShowRecoveryPhrase(false);
    setNotice('');
    setError('');
    setNeedsReplacement(false);

    if (authLoading) {
      setMode('checking');
      return () => { cancelled = true; };
    }

    if (!user?.id) {
      setMode('summary');
      return () => { cancelled = true; };
    }

    try {
      const existing = getLocalEvmWalletMetadata(user.id);
      if (cancelled) return;
      setMetadata(existing);
      setMode(existing ? 'unlock' : 'summary');
    } catch (cause) {
      if (cancelled) return;
      setError(cause instanceof Error ? cause.message : 'Could not read the local wallet record.');
      setNeedsReplacement(true);
      setMode('summary');
    }

    return () => { cancelled = true; };
  }, [user?.id, authLoading]);

  useEffect(() => {
    if (!metadata?.address) {
      setBalances([]);
      setBalanceError('');
      return;
    }
    let cancelled = false;
    setBalanceLoading(true);
    setBalanceError('');
    void readEvmBalances(metadata.address).then((next) => {
      if (cancelled) return;
      setBalances(next);
      if (next.every((item) => !item.available)) {
        setBalanceError('Could not read balances from the current RPC endpoints. No balance has been changed.');
      } else if (next.some((item) => !item.available)) {
        setBalanceError('Some networks are unavailable right now. Balances shown as unavailable must not be treated as zero.');
      }
    }).catch((cause) => {
      if (!cancelled) setBalanceError(cause instanceof Error ? cause.message : 'Could not load on-chain balances.');
    }).finally(() => {
      if (!cancelled) setBalanceLoading(false);
    });
    return () => { cancelled = true; };
  }, [metadata?.address]);

  const reviewTransfer = async () => {
    if (!walletMnemonic) {
      setError('Unlock your personal wallet with your PIN before reviewing a transfer.');
      return;
    }
    setReviewBusy(true);
    setError('');
    setNotice('');
    setTransferReview(null);
    setSendConfirmed(false);
    setSendResult(null);
    try {
      const result = await estimateEvmUsdtTransfer(walletMnemonic, sendNetwork, sendDestination, sendAmount);
      setTransferReview(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not validate this transfer.');
    } finally {
      setReviewBusy(false);
    }
  };

  const submitTransfer = async () => {
    if (!walletMnemonic || !transferReview || !sendConfirmed) return;
    setSendBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await sendEvmUsdt(walletMnemonic, sendNetwork, sendDestination, sendAmount);
      setSendResult({ ...result, status: 'pending' });
      setTransferReview(null);
      setSendConfirmed(false);
      setSendAmount('');
      setSendDestination('');
      lockWallet();
      setNotice('Transaction submitted. The wallet is locked again. Check the on-chain receipt before treating the transfer as complete.');
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Could not submit the transfer.';
      if (message.includes('TRANSFER_SUBMISSION_UNCERTAIN')) {
        lockWallet();
        setNotice('The RPC response was unclear. The wallet was locked to prevent accidental repeat sends. Check the chain explorer and destination wallet before trying again.');
        setError('AURA could not verify whether the network accepted this transfer. Do not retry until you have checked the transaction explorer and destination wallet.');
      } else {
        setError(message);
      }
    } finally {
      setSendBusy(false);
    }
  };

  const checkLatestTransaction = async () => {
    if (!sendResult) return;
    setStatusBusy(true);
    try {
      const status = await readEvmTransactionStatus(sendResult.network, sendResult.hash);
      setSendResult((previous) => previous ? { ...previous, status } : previous);
      if (status === 'confirmed') {
        setNotice('The chain reports a successful transaction receipt. Refresh the balances to reconcile the latest token amounts.');
        await refreshBalances(metadata?.address);
      } else if (status === 'failed') {
        setError('The chain reports that this transaction failed. Review the explorer receipt; no automatic resend was attempted.');
      } else if (status === 'unavailable') {
        setError('Could not read the transaction receipt from available RPC endpoints. Check the explorer before retrying.');
      } else {
        setNotice('The transaction has no confirmed receipt yet. Do not submit it again while it is pending.');
      }
    } finally {
      setStatusBusy(false);
    }
  };

  const resetForm = () => {
    setMode(metadata ? 'unlock' : 'summary');
    setDraftPhrase('');
    setImportPhrase('');
    setChallengePositions([]);
    setChallengeAnswers(['', '', '']);
    setBackupConfirmed(false);
    setReplaceConfirmed(false);
    setPin('');
    setConfirmPin('');
    setError('');
    setNotice('');
  };

  const beginCreate = () => {
    setError('');
    setNotice('');
    try {
      const phrase = createRecoveryPhrase();
      setDraftPhrase(phrase);
      setChallengePositions(randomPositions(phrase.split(' ').length, 3));
      setChallengeAnswers(['', '', '']);
      setBackupConfirmed(false);
      setPin('');
      setConfirmPin('');
      setMode('create');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create a recovery phrase on this device.');
    }
  };

  const beginImport = () => {
    setError('');
    setNotice('');
    setImportPhrase('');
    setPin('');
    setConfirmPin('');
    setReplaceConfirmed(false);
    setMode('import');
  };

  const savePhrase = async (phraseValue: string, replaceExisting: boolean) => {
    if (!user?.id) throw new Error('Sign in to AURA before creating a local wallet.');
    if (pin !== confirmPin) throw new Error('The two PIN entries do not match.');
    const normalized = normalizeRecoveryPhrase(phraseValue);
    const saved = await storeEncryptedLocalEvmWallet(user.id, normalized, pin, { replaceExisting });
    setMetadata(saved);
    setWalletMnemonic(normalized);
    setShowRecoveryPhrase(false);
    setDraftPhrase('');
    setImportPhrase('');
    setPin('');
    setConfirmPin('');
    setChallengePositions([]);
    setChallengeAnswers(['', '', '']);
    setBackupConfirmed(false);
    setReplaceConfirmed(false);
    setNeedsReplacement(false);
    setMode('unlock');
    setNotice('Wallet created on this device. Keep your recovery phrase somewhere safe and private.');
  };

  const createWallet = async () => {
    setBusy(true);
    setError('');
    try {
      const words = normalizeRecoveryPhrase(draftPhrase).split(' ');
      const allAnswersCorrect = challengePositions.every((position, index) =>
        (challengeAnswers[index] || '').trim().toLowerCase() === words[position]
      );
      if (!backupConfirmed) throw new Error('Confirm that you have written down your recovery phrase before continuing.');
      if (!allAnswersCorrect) throw new Error('One or more recovery-word checks are incorrect. Check the numbered words and try again.');
      await savePhrase(draftPhrase, false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the encrypted wallet.');
    } finally {
      setBusy(false);
    }
  };

  const importWallet = async () => {
    setBusy(true);
    setError('');
    try {
      const replacing = Boolean(metadata || needsReplacement);
      if (replacing && !replaceConfirmed) {
        throw new Error('Confirm the local-wallet replacement warning before replacing this device’s encrypted copy.');
      }
      await savePhrase(importPhrase, replacing);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not import the recovery phrase.');
    } finally {
      setBusy(false);
    }
  };

  const unlockWallet = async () => {
    if (!user?.id) return;
    setBusy(true);
    setError('');
    try {
      const unlocked = await unlockLocalEvmWallet(user.id, pin);
      setMetadata({
        version: unlocked.version,
        address: unlocked.address,
        derivationPath: unlocked.derivationPath,
      });
      setWalletMnemonic(unlocked.mnemonic);
      setShowRecoveryPhrase(false);
      setPin('');
      setMode('unlock');
      setNotice('Wallet unlocked on this device.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not unlock the wallet.');
    } finally {
      setBusy(false);
    }
  };

  const lockWallet = () => {
    setWalletMnemonic('');
    setShowRecoveryPhrase(false);
    setPin('');
    setConfirmPin('');
    setNotice('Wallet locked. The encrypted local copy was not changed.');
  };

  useEffect(() => {
    if (!walletMnemonic) return;
    const lockForBackground = () => {
      setWalletMnemonic('');
      setShowRecoveryPhrase(false);
      setPin('');
      setConfirmPin('');
      setNotice('Wallet auto-locked. The encrypted local copy was not changed.');
    };
    const timeoutId = window.setTimeout(lockForBackground, 5 * 60 * 1000);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') lockForBackground();
    };
    window.addEventListener('pagehide', lockForBackground);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener('pagehide', lockForBackground);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [walletMnemonic]);

  const copyAddress = async () => {
    if (!metadata?.address) return;
    try {
      await navigator.clipboard.writeText(metadata.address);
      setCopied(true);
      setNotice('Public wallet address copied.');
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError('Copy is unavailable in this browser. Select and copy the public address manually.');
    }
  };

  const words = normalizeRecoveryPhrase(draftPhrase).split(' ').filter(Boolean);
  const hasUnlockedWallet = Boolean(metadata && walletMnemonic);

  return (
    <section className="mx-1 rounded-3xl border border-emerald-400/20 bg-gradient-to-br from-emerald-950/30 to-[#111118] p-4 shadow-xl">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
          <Wallet className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-stone-100">Non-custodial EVM wallet</h2>
            <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[9px] font-mono uppercase tracking-wider text-emerald-200">
              {hasUnlockedWallet ? 'Unlocked on device' : metadata ? 'Locked on device' : 'User controlled'}
            </span>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-stone-400">
            Your recovery phrase is encrypted on this device. It is never sent to AURA’s server.
          </p>
        </div>
      </div>

      {mode === 'checking' ? (
        <div className="mt-4 rounded-xl bg-white/[0.03] p-3 text-xs text-stone-400">Checking this device’s local wallet…</div>
      ) : !user ? (
        <div className="mt-4">
          <p className="text-xs text-stone-400">Sign in to keep this device’s wallet associated with your AURA account.</p>
          <button onClick={() => openAuth('signin')} className="mt-3 w-full rounded-xl bg-emerald-300 py-3 text-xs font-bold text-stone-950">Sign in to AURA</button>
        </div>
      ) : mode === 'create' ? (
        <div className="mt-4 space-y-3">
          <div className="rounded-xl border border-amber-400/25 bg-amber-400/[0.06] p-3 text-[11px] leading-relaxed text-amber-100">
            Write these words down offline and keep them private. Anyone with this phrase can control the wallet. AURA cannot recover it for you.
          </div>
          <div className="grid grid-cols-3 gap-2">
            {words.map((word, index) => (
              <div key={index} className="rounded-lg border border-white/10 bg-black/20 px-2 py-2 text-center">
                <span className="block text-[9px] text-stone-500">{index + 1}</span>
                <span className="text-xs font-mono text-stone-100">{word}</span>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-stone-300">Confirm three recovery words</p>
            <div className="grid grid-cols-3 gap-2">
              {challengePositions.map((position, index) => (
                <label key={position} className="min-w-0">
                  <span className="mb-1 block text-[9px] text-stone-500">Word #{position + 1}</span>
                  <input
                    value={challengeAnswers[index] || ''}
                    onChange={(event) => setChallengeAnswers((previous) => previous.map((value, at) => at === index ? event.target.value : value))}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-xs text-stone-100 outline-none focus:border-emerald-300/50"
                    aria-label={'Recovery word ' + (position + 1)}
                  />
                </label>
              ))}
            </div>
          </div>
          <label className="flex items-start gap-2 text-[10px] leading-relaxed text-stone-300">
            <input type="checkbox" checked={backupConfirmed} onChange={(event) => setBackupConfirmed(event.target.checked)} className="mt-0.5 accent-emerald-300" />
            I have written down the recovery phrase offline. I understand AURA cannot reset it or restore this wallet if I lose it.
          </label>
          <PinFields pin={pin} confirmPin={confirmPin} setPin={setPin} setConfirmPin={setConfirmPin} />
          <button onClick={() => void createWallet()} disabled={busy} className="w-full rounded-xl bg-emerald-300 py-3 text-xs font-bold text-stone-950 disabled:opacity-50">
            {busy ? 'Encrypting wallet…' : 'Confirm and encrypt wallet'}
          </button>
          <button onClick={resetForm} disabled={busy} className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-2.5 text-xs text-stone-400">Cancel</button>
        </div>
      ) : mode === 'import' ? (
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="mb-1 block text-[10px] text-stone-400">Recovery phrase</span>
            <textarea
              value={importPhrase}
              onChange={(event) => setImportPhrase(event.target.value)}
              rows={3}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="off"
              placeholder="Enter your existing recovery words"
              className="w-full resize-none rounded-xl border border-white/10 bg-black/20 p-3 text-xs leading-relaxed text-stone-100 outline-none focus:border-emerald-300/50"
            />
          </label>
          <PinFields pin={pin} confirmPin={confirmPin} setPin={setPin} setConfirmPin={setConfirmPin} />
          {(metadata || needsReplacement) && (
            <label className="flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/[0.05] p-3 text-[10px] leading-relaxed text-amber-100">
              <input type="checkbox" checked={replaceConfirmed} onChange={(event) => setReplaceConfirmed(event.target.checked)} className="mt-0.5 accent-amber-300" />
              Replace the encrypted wallet copy on this device. I have saved the old recovery phrase elsewhere or understand that this device will no longer unlock that old wallet.
            </label>
          )}
          <button onClick={() => void importWallet()} disabled={busy} className="w-full rounded-xl bg-emerald-300 py-3 text-xs font-bold text-stone-950 disabled:opacity-50">
            {busy ? 'Importing and encrypting…' : 'Import and encrypt wallet'}
          </button>
          <button onClick={resetForm} disabled={busy} className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-2.5 text-xs text-stone-400">Cancel</button>
        </div>
      ) : metadata ? (
        <div className="mt-4 space-y-3">
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[9px] font-mono uppercase tracking-wider text-stone-500">Public EVM address</span>
              <button onClick={() => void copyAddress()} className="flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1.5 text-[10px] text-stone-300" aria-label="Copy public EVM wallet address">
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
                Copy
              </button>
            </div>
            <p className="mt-2 break-all font-mono text-[11px] leading-relaxed text-emerald-100">{metadata.address}</p>
            <p className="mt-2 text-[9px] text-stone-500">Same address on Ethereum, Polygon, Arbitrum and BNB Smart Chain (EVM networks).</p>
          </div>

          {!hasUnlockedWallet ? (
            <form onSubmit={(event) => { event.preventDefault(); void unlockWallet(); }} className="space-y-2">
              <label className="block">
                <span className="mb-1 block text-[10px] text-stone-400">Unlock with your device PIN</span>
                <input
                  type="password"
                  inputMode="numeric"
                  autoComplete="current-password"
                  pattern="[0-9]{8,12}"
                  minLength={8}
                  maxLength={12}
                  value={pin}
                  onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 12))}
                  placeholder="8–12 digit PIN"
                  className="w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm font-mono tracking-[0.2em] text-stone-100 outline-none focus:border-emerald-300/50"
                />
              </label>
              <button type="submit" disabled={busy} className="w-full rounded-xl bg-emerald-300 py-3 text-xs font-bold text-stone-950 disabled:opacity-50">
                {busy ? 'Unlocking…' : 'Unlock wallet'}
              </button>
              <button type="button" onClick={beginImport} className="w-full py-2 text-[10px] text-stone-400 underline underline-offset-4">Restore from a recovery phrase</button>
            </form>
          ) : (
            <>
              <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.05] p-3 text-[10px] leading-relaxed text-emerald-100">
                <ShieldCheck className="mr-1 inline h-3.5 w-3.5" />
                Unlocked in memory on this device. The encrypted saved copy has not been changed.
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowRecoveryPhrase((value) => !value)} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] py-3 text-xs text-stone-200">
                  {showRecoveryPhrase ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  {showRecoveryPhrase ? 'Hide recovery phrase' : 'Reveal recovery phrase'}
                </button>
                <button onClick={lockWallet} className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs text-stone-300">
                  <LockKeyhole className="h-4 w-4" /> Lock
                </button>
              </div>
              {showRecoveryPhrase && (
                <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.04] p-3">
                  <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-amber-200">
                    <AlertTriangle className="h-3.5 w-3.5" /> Keep this phrase private
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {normalizeRecoveryPhrase(walletMnemonic).split(' ').map((word, index) => (
                      <div key={index} className="rounded-lg border border-white/10 bg-black/20 px-2 py-2 text-center">
                        <span className="block text-[9px] text-stone-500">{index + 1}</span>
                        <span className="text-[11px] font-mono text-stone-100">{word}</span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-[9px] leading-relaxed text-stone-400">Hide it before sharing your screen. Do not send it to anyone, including AURA support.</p>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-[11px] leading-relaxed text-stone-400">
            Create a new wallet with a fresh 12-word phrase, or import a wallet you already control. The recovery phrase is encrypted locally using your PIN; only the public address is visible while locked.
          </div>
          <button onClick={beginCreate} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-300 py-3 text-xs font-bold text-stone-950">
            <KeyRound className="h-4 w-4" /> Create new wallet
          </button>
          <button onClick={beginImport} className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-3 text-xs text-stone-200">Import recovery phrase</button>
        </div>
      )}

      {metadata && mode !== 'create' && mode !== 'import' && mode !== 'summary' && (
        <div className="mt-4 space-y-4">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-semibold text-stone-100">Live on-chain balances</h3>
                <p className="mt-1 text-[9px] leading-relaxed text-stone-500">Read from the selected network's RPC. The internal AURA ledger is separate from this wallet.</p>
              </div>
              <button
                type="button"
                onClick={() => void refreshBalances(metadata.address)}
                disabled={balanceLoading}
                className="flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-2 text-[10px] text-stone-200 disabled:opacity-50"
              >
                {balanceLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Refresh
              </button>
            </div>

            <div className="mt-3 space-y-2">
              {EVM_NETWORKS.map((network) => {
                const balance = balances.find((item) => item.network === network.key);
                return (
                  <div key={network.key} className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5">
                    <div className="min-w-0">
                      <span className="block text-[10px] font-semibold text-stone-200">{network.label}</span>
                      <span className="mt-0.5 block text-[9px] text-stone-500">Gas: {balance?.available ? displayBalance(balance.native, 6) + ' ' + balance.nativeSymbol : balanceLoading ? 'Checking…' : 'Unavailable'}</span>
                    </div>
                    <div className="text-right">
                      <span className="block font-mono text-xs text-emerald-200">
                        {balance?.available ? displayBalance(balance.usdt) + ' USDT' : balanceLoading ? 'Checking…' : 'Unavailable'}
                      </span>
                      <span className="mt-0.5 block text-[8px] text-stone-600">
                        {balance?.available ? 'Block ' + balance.blockNumber : 'Not assumed to be zero'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {balanceError && <div className="mt-3 rounded-lg border border-amber-400/15 bg-amber-400/[0.04] p-2.5 text-[9px] leading-relaxed text-amber-100">{balanceError}</div>}
          </div>

          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-950/10 p-3">
            <div className="flex items-center gap-2">
              <ArrowUpRight className="h-4 w-4 text-emerald-300" />
              <h3 className="text-xs font-semibold text-stone-100">Send USDT from your wallet</h3>
            </div>
            <p className="mt-1 text-[9px] leading-relaxed text-stone-500">Transactions are signed on this device. Aura does not receive your recovery phrase. You must hold the network's native gas token.</p>

            {!hasUnlockedWallet ? (
              <div className="mt-3 rounded-xl border border-white/5 bg-black/20 p-3 text-[10px] leading-relaxed text-stone-400">
                Unlock the wallet with your PIN before reviewing a transfer.
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                <label className="block">
                  <span className="mb-1 block text-[9px] font-mono uppercase tracking-wider text-stone-500">Network</span>
                  <select
                    value={sendNetwork}
                    onChange={(event) => {
                      setSendNetwork(event.target.value as EvmNetwork);
                      setTransferReview(null);
                      setSendConfirmed(false);
                      setSendResult(null);
                    }}
                    className="w-full rounded-xl border border-white/10 bg-[#111118] p-3 text-xs text-stone-100 outline-none focus:border-emerald-300/50"
                  >
                    {EVM_NETWORKS.map((network) => (
                      <option key={network.key} value={network.key}>{network.label} · USDT</option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1 block text-[9px] font-mono uppercase tracking-wider text-stone-500">Recipient address</span>
                  <input
                    value={sendDestination}
                    onChange={(event) => {
                      setSendDestination(event.target.value);
                      setTransferReview(null);
                      setSendConfirmed(false);
                      setSendResult(null);
                    }}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder="0x…"
                    className="w-full rounded-xl border border-white/10 bg-black/20 p-3 text-xs font-mono text-stone-100 outline-none focus:border-emerald-300/50"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-[9px] font-mono uppercase tracking-wider text-stone-500">USDT amount</span>
                  <input
                    value={sendAmount}
                    onChange={(event) => {
                      setSendAmount(event.target.value);
                      setTransferReview(null);
                      setSendConfirmed(false);
                      setSendResult(null);
                    }}
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="0.00"
                    className="w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm font-mono text-stone-100 outline-none focus:border-emerald-300/50"
                  />
                </label>

                {!transferReview ? (
                  <button
                    type="button"
                    onClick={() => void reviewTransfer()}
                    disabled={reviewBusy || sendBusy || !sendDestination.trim() || !sendAmount.trim()}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 py-3 text-xs font-semibold text-stone-100 disabled:opacity-40"
                  >
                    {reviewBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                    {reviewBusy ? 'Checking balance and gas…' : 'Review transfer'}
                  </button>
                ) : (
                  <div className="space-y-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.04] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[10px] text-stone-400">You will send</span>
                      <span className="font-mono text-sm font-semibold text-amber-100">{transferReview.amount} USDT</span>
                    </div>
                    <div className="space-y-1.5 border-t border-white/5 pt-2 text-[10px]">
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-stone-500">Network</span>
                        <span className="text-right text-stone-200">{transferReview.label}</span>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-stone-500">From</span>
                        <span className="max-w-[68%] break-all text-right font-mono text-stone-300">{transferReview.from}</span>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-stone-500">To</span>
                        <span className="max-w-[68%] break-all text-right font-mono text-stone-200">{transferReview.destination}</span>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-stone-500">Estimated network fee</span>
                        <span className="text-right text-stone-200">{displayBalance(transferReview.estimatedNativeFee, 8)} {transferReview.nativeSymbol}</span>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-stone-500">Available gas asset</span>
                        <span className="text-right text-stone-200">{displayBalance(transferReview.nativeBalance, 8)} {transferReview.nativeSymbol}</span>
                      </div>
                    </div>

                    <p className="text-[9px] leading-relaxed text-amber-100">This estimate can change before broadcast. Blockchain transfers cannot be reversed. AURA does not charge an app fee in this wallet flow.</p>
                    <label className="flex items-start gap-2 text-[10px] leading-relaxed text-stone-200">
                      <input type="checkbox" checked={sendConfirmed} onChange={(event) => setSendConfirmed(event.target.checked)} className="mt-0.5 accent-emerald-300" />
                      I checked the network, amount, and full recipient address. I understand this sends real USDT on mainnet.
                    </label>
                    <button
                      type="button"
                      onClick={() => void submitTransfer()}
                      disabled={!sendConfirmed || sendBusy}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-300 py-3 text-xs font-bold text-stone-950 disabled:opacity-40"
                    >
                      {sendBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />}
                      {sendBusy ? 'Signing and submitting…' : 'Confirm and send USDT'}
                    </button>
                    <button type="button" onClick={() => { setTransferReview(null); setSendConfirmed(false); }} disabled={sendBusy} className="w-full py-1.5 text-[10px] text-stone-400 underline underline-offset-4">Edit transfer details</button>
                  </div>
                )}
              </div>
            )}

            {sendResult && (
              <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold text-stone-100">Latest transaction</span>
                  <span className={sendResult.status === 'confirmed' ? 'rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[8px] uppercase tracking-wider text-emerald-200' : sendResult.status === 'failed' ? 'rounded-full border border-rose-400/20 bg-rose-400/10 px-2 py-1 text-[8px] uppercase tracking-wider text-rose-200' : 'rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-1 text-[8px] uppercase tracking-wider text-amber-100'}>
                    {sendResult.status}
                  </span>
                </div>
                <p className="mt-2 break-all font-mono text-[9px] text-stone-300">{sendResult.hash}</p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <a href={TRANSACTION_EXPLORERS[sendResult.network] + sendResult.hash} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[10px] text-emerald-200 underline underline-offset-4">
                    View on explorer <ArrowUpRight className="h-3 w-3" />
                  </a>
                  <button type="button" onClick={() => void checkLatestTransaction()} disabled={statusBusy} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-2 text-[10px] text-stone-200 disabled:opacity-50">
                    {statusBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                    Check confirmation
                  </button>
                </div>
                <p className="mt-2 text-[9px] leading-relaxed text-stone-500">Do not send the same amount again if the transaction is pending or the RPC result is unclear.</p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mt-3 space-y-1 text-[9px] leading-relaxed text-stone-500">
        <p>Google sign-in and AURA TOTP protect your AURA account. Your wallet phrase and device PIN are separate; AURA cannot reset them.</p>
        <p>Balances are read from public RPC endpoints and may be temporarily unavailable. Transfers are signed locally, checked for token precision and estimated gas, and require your explicit confirmation. AURA cannot recover a lost seed phrase.</p><p>This personal wallet is separate from the older AURA internal ledger. No transfer is credited to that ledger simply because it appears on this address.</p>
      </div>

      {notice && <div className="mt-3 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.05] p-3 text-[10px] text-emerald-200">{notice}</div>}
      {error && <div role="alert" className="mt-3 rounded-xl border border-rose-400/20 bg-rose-400/[0.05] p-3 text-[10px] leading-relaxed text-rose-200">{error}</div>}
    </section>
  );
};

const PinFields: React.FC<{
  pin: string;
  confirmPin: string;
  setPin: (value: string) => void;
  setConfirmPin: (value: string) => void;
}> = ({ pin, confirmPin, setPin, setConfirmPin }) => (
  <div className="grid grid-cols-2 gap-2">
    <label className="min-w-0">
      <span className="mb-1 block text-[10px] text-stone-400">Wallet PIN</span>
      <input
        type="password"
        inputMode="numeric"
        autoComplete="new-password"
        pattern="[0-9]{8,12}"
        minLength={8}
        maxLength={12}
        value={pin}
        onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 12))}
        placeholder="8–12 digits"
        className="w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm font-mono tracking-[0.15em] text-stone-100 outline-none focus:border-emerald-300/50"
      />
    </label>
    <label className="min-w-0">
      <span className="mb-1 block text-[10px] text-stone-400">Confirm PIN</span>
      <input
        type="password"
        inputMode="numeric"
        autoComplete="new-password"
        pattern="[0-9]{8,12}"
        minLength={8}
        maxLength={12}
        value={confirmPin}
        onChange={(event) => setConfirmPin(event.target.value.replace(/\D/g, '').slice(0, 12))}
        placeholder="Repeat PIN"
        className="w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm font-mono tracking-[0.15em] text-stone-100 outline-none focus:border-emerald-300/50"
      />
    </label>
  </div>
);
