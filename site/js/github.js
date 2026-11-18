'use strict';

// GitHub REST API-тай ажиллах жижиг клиент.
// Админ ном нэмэхэд файлуудыг шууд репо руу commit хийнэ.
(() => {
  function decodeBase64Utf8(base64) {
    const binary = atob(String(base64).replace(/\s/g, ''));
    const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  const encodePath = (path) => path.split('/').map(encodeURIComponent).join('/');

  class GitHubRepo {
    constructor({ owner, repo, token }) {
      this.owner = owner;
      this.repo = repo;
      this.token = token;
      this.base = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
    }

    async request(method, path, body) {
      const res = await fetch(`https://api.github.com${path}`, {
        method,
        cache: 'no-store',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${this.token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        let message = res.statusText;
        try {
          message = (await res.json()).message || message;
        } catch {
          // JSON биш хариу
        }
        const err = new Error(message);
        err.status = res.status;
        throw err;
      }
      return res.status === 204 ? null : res.json();
    }

    repoInfo() {
      return this.request('GET', this.base);
    }

    /** Репо доторх текст файлыг уншина. Байхгүй бол null. */
    async readText(path, branch) {
      try {
        const data = await this.request(
          'GET', `${this.base}/contents/${encodePath(path)}?ref=${encodeURIComponent(branch)}`,
        );
        return decodeBase64Utf8(data.content);
      } catch (err) {
        if (err.status === 404) return null;
        throw err;
      }
    }

    /**
     * Олон файлыг нэг commit-оор нэмэх/солих/устгах.
     * files: [{ path, base64 } | { path, text } | { path, delete: true }]
     */
    async commit({ branch, message, files }) {
      const refPath = `${this.base}/git/refs/heads/${encodePath(branch)}`;
      const ref = await this.request('GET', `${this.base}/git/ref/heads/${encodePath(branch)}`);
      const headSha = ref.object.sha;
      const head = await this.request('GET', `${this.base}/git/commits/${headSha}`);

      const entries = [];
      const deletions = [];
      for (const file of files) {
        if (file.delete) {
          deletions.push({ path: file.path, mode: '100644', type: 'blob', sha: null });
          continue;
        }
        const blob = await this.request('POST', `${this.base}/git/blobs`,
          file.base64 !== undefined
            ? { content: file.base64, encoding: 'base64' }
            : { content: file.text, encoding: 'utf-8' });
        entries.push({ path: file.path, mode: '100644', type: 'blob', sha: blob.sha });
      }

      let tree;
      try {
        tree = await this.request('POST', `${this.base}/git/trees`,
          { base_tree: head.tree.sha, tree: [...entries, ...deletions] });
      } catch (err) {
        // Устгах гэж буй файл аль хэдийн байхгүй бол устгалгүйгээр дахин оролдоно
        if (!deletions.length || err.status !== 422) throw err;
        tree = await this.request('POST', `${this.base}/git/trees`,
          { base_tree: head.tree.sha, tree: entries });
      }

      const commit = await this.request('POST', `${this.base}/git/commits`,
        { message, tree: tree.sha, parents: [headSha] });
      await this.request('PATCH', refPath, { sha: commit.sha, force: false });
      return commit.sha;
    }
  }

  window.GitHubRepo = GitHubRepo;
  window.fileToBase64 = fileToBase64;
})();
