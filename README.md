# Huckathon

モダンで清潔感のあるUIを採用した、リアルタイム・グループチャットアプリケーションです。

## 概要

このプロジェクトは、Next.jsとSupabaseを組み合わせて構築されたSlack風のチャットツールです。リアルタイムなメッセージ送受信に加え、リアクションやスレッド機能など、現代的なチャット体験を提供します。

> [!NOTE]
> **AI制作物に関する注記**
> このプロジェクト（コード、UIデザイン、ドキュメントを含む）は、AIアシスタント **Antigravity** によって生成・編集されました。AIによるハッカソン形式のプロトタイピングのデモンストレーションとして作成されています。

## 主な機能

- **リアルタイムメッセージ**: リロード不要で瞬時にメッセージが届きます。
- **チャンネル管理**: `general`, `random`, `huckathon-dev` などの複数チャンネル。
- **リアクション**: メッセージに絵文字で反応できます。
- **スレッド**: 特定のメッセージに対して返信し、会話を整理できます。
- **モダンUI**: ガラスモーフィズムとソフトな質感を活かしたデザイン。

## 技術スタック

- **Frontend**: Next.js (App Router), Tailwind CSS, Lucide React
- **Backend**: Supabase (Postgres, Realtime)
- **Design**: Modern Clean UI / Glassmorphism

## セットアップ

1. リポジトリをクローン
2. `.env.local` に Supabase の認証情報を設定
3. `npm install`
4. `npm run dev`
