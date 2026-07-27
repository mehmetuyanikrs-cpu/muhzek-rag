-- pgvector + bilgi parçaları (chunks) + kosinüs benzerliği için hnsw indeks.
-- İçerik tekilliği md5 hash üzerinden kontrol edilir (uzun Türkçe/UTF-8
-- paragraflar çıplak btree indeksinin satır boyutu sınırını aşabiliyor).

create extension if not exists vector;

create table if not exists chunks (
  id bigserial primary key,
  kaynak text not null,             -- belge adı (örn. "imar/planli-alanlar-imar-yonetmeligi")
  bolum text not null default '',   -- bölüm/MADDE etiketi
  icerik text not null check (char_length(icerik) between 1 and 8000),
  icerik_hash text generated always as (md5(icerik)) stored,
  embedding vector(768) not null,
  created_at timestamptz not null default now()
);

create unique index if not exists chunks_tekil_idx
  on chunks (kaynak, bolum, icerik_hash);

create index if not exists chunks_embedding_idx
  on chunks using hnsw (embedding vector_cosine_ops);
