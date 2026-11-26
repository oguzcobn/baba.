# CPU shim for flash_attn.modules.mha.MHA (cross-attention subset used by UniRig).
# Parameter names (Wq, Wkv, out_proj) match flash_attn so checkpoints load unchanged.
import torch, torch.nn as nn, torch.nn.functional as F
class MHA(nn.Module):
    def __init__(self, embed_dim, num_heads, cross_attn=False, qkv_proj_bias=True, out_proj_bias=True, softmax_scale=None, **kw):
        super().__init__()
        assert cross_attn, "shim only implements cross_attn"
        self.embed_dim, self.num_heads = embed_dim, num_heads
        self.head_dim = embed_dim // num_heads
        self.softmax_scale = softmax_scale
        self.Wq = nn.Linear(embed_dim, embed_dim, bias=qkv_proj_bias)
        self.Wkv = nn.Linear(embed_dim, 2 * embed_dim, bias=qkv_proj_bias)
        self.out_proj = nn.Linear(embed_dim, embed_dim, bias=out_proj_bias)
    def forward(self, x, x_kv=None, **kw):
        B, Lq, _ = x.shape
        x_kv = x if x_kv is None else x_kv
        Lk = x_kv.shape[1]
        q = self.Wq(x).view(B, Lq, self.num_heads, self.head_dim).transpose(1, 2)
        kv = self.Wkv(x_kv).view(B, Lk, 2, self.num_heads, self.head_dim)
        k, v = kv[:, :, 0].transpose(1, 2), kv[:, :, 1].transpose(1, 2)
        o = F.scaled_dot_product_attention(q, k, v, scale=self.softmax_scale)
        return self.out_proj(o.transpose(1, 2).reshape(B, Lq, self.embed_dim))
