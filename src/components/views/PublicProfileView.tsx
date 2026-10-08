import React from 'react';
import { ArrowLeft, CheckCircle2, Image as ImageIcon, Loader2 } from 'lucide-react';
import { Artwork, Creator } from '../../types';
import { supabase } from '../../lib/supabase';
import { createNeutralAvatar } from '../../lib/avatar';
import { ArtworkCanvas } from '../ArtworkCanvas';

interface PublicProfileViewProps {
  creator: Creator;
  artworks: Artwork[];
  onBack: () => void;
  onOpenDetail: (artwork: Artwork) => void;
}

export const PublicProfileView: React.FC<PublicProfileViewProps> = ({
  creator,
  artworks,
  onBack,
  onOpenDetail,
}) => {
  const [profile, setProfile] = React.useState({
    name: creator.name,
    handle: creator.handle,
    avatar: creator.avatar || createNeutralAvatar(creator.id || creator.handle),
    bio: creator.bio || '',
    cover: '',
  });
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;

    const loadProfile = async () => {
      if (!creator.id) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('profiles')
        .select('id,handle,display_name,bio,avatar_url,cover_url')
        .eq('id', creator.id)
        .maybeSingle();

      if (cancelled) return;

      if (data) {
        setProfile({
          name: data.display_name || creator.name || 'AURA Creator',
          handle: data.handle || creator.handle || '@creator',
          avatar: data.avatar_url || createNeutralAvatar(creator.id),
          bio: data.bio || '',
          cover: data.cover_url || '',
        });
      } else {
        setProfile((previous) => ({
          ...previous,
          avatar: previous.avatar || createNeutralAvatar(creator.id),
        }));
      }

      setLoading(false);
    };

    void loadProfile();
    return () => { cancelled = true; };
  }, [creator.id]);

  const creatorArtworks = React.useMemo(
    () => artworks.filter((artwork) => artwork.creator?.id === creator.id),
    [artworks, creator.id],
  );

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-[#09090d] text-stone-100">
      <div className="mx-auto min-h-full w-full max-w-xl pb-10">
        <div className="sticky top-0 z-30 flex items-center justify-between border-b border-white/5 bg-[#09090d]/90 px-3 py-3 backdrop-blur-xl">
          <button
            type="button"
            onClick={onBack}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-stone-300 hover:bg-white/10"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-stone-500">
            Public Profile
          </span>
          <div className="w-9" />
        </div>

        <div className="px-3 pt-3">
          <div className="overflow-hidden rounded-[30px] border border-white/10 bg-[#111118] shadow-2xl">
            <div
              className="relative h-28 overflow-hidden"
              style={{
                backgroundImage: profile.cover
                  ? `linear-gradient(180deg, rgba(8,8,12,.08), rgba(8,8,12,.94)), url(${profile.cover})`
                  : 'radial-gradient(circle at 18% 20%, rgba(245,158,11,.22), transparent 35%), radial-gradient(circle at 82% 10%, rgba(34,211,238,.16), transparent 30%), linear-gradient(135deg, #181620, #09090d 70%)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            />
            <div className="relative px-5 pb-5">
              <div className="-mt-10 flex items-end justify-between">
                <img
                  src={profile.avatar || createNeutralAvatar(creator.id || creator.handle)}
                  alt={profile.name}
                  className="h-20 w-20 rounded-full border-4 border-[#111118] bg-[#1b1b25] object-cover shadow-xl"
                  referrerPolicy="no-referrer"
                />
                {loading && <Loader2 className="mb-2 h-4 w-4 animate-spin text-stone-500" />}
              </div>

              <div className="mt-3">
                <div className="flex items-center gap-2">
                  <h1 className="truncate font-serif text-2xl text-stone-50">{profile.name}</h1>
                  {creator.verified && <CheckCircle2 className="h-4 w-4 shrink-0 text-amber-400" />}
                </div>
                <div className="mt-1 font-mono text-xs text-stone-500">{profile.handle}</div>
                {profile.bio && <p className="mt-3 text-sm leading-6 text-stone-300">{profile.bio}</p>}
              </div>

              <div className="mt-5 grid grid-cols-2 divide-x divide-white/5 rounded-2xl border border-white/5 bg-white/[0.025]">
                <div className="py-3 text-center">
                  <span className="block font-serif text-lg text-stone-100">{creatorArtworks.length}</span>
                  <span className="font-mono text-[9px] uppercase tracking-wider text-stone-500">Public Works</span>
                </div>
                <div className="py-3 text-center">
                  <span className="block font-serif text-lg text-stone-100">
                    {creatorArtworks.reduce((sum, artwork) => sum + Number(artwork.likes || 0), 0).toLocaleString()}
                  </span>
                  <span className="font-mono text-[9px] uppercase tracking-wider text-stone-500">Likes</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-2 px-1">
            <ImageIcon className="h-4 w-4 text-cyan-300" />
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-stone-400">
              Public Works
            </span>
          </div>

          {creatorArtworks.length === 0 ? (
            <div className="mt-3 rounded-3xl border border-white/5 bg-white/[0.02] p-10 text-center">
              <p className="text-xs text-stone-500">No public works yet.</p>
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-3">
              {creatorArtworks.map((artwork) => (
                <button
                  key={artwork.id}
                  type="button"
                  onClick={() => onOpenDetail(artwork)}
                  className="overflow-hidden rounded-2xl border border-white/10 bg-[#111118] text-left transition hover:border-white/20"
                >
                  <div className="aspect-[3/4] bg-black">
                    <ArtworkCanvas artwork={artwork} showOverlayGrain={false} />
                  </div>
                  <div className="p-3">
                    <div className="truncate text-xs font-semibold text-stone-100">{artwork.title}</div>
                    <div className="mt-1 truncate text-[10px] text-stone-500">
                      {artwork.currentValue.toLocaleString()} USDT
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
