# CPU shim for flash_attn (UniRig CPU inference). Pure PyTorch SDPA equivalents.
import torch
import torch.nn.functional as F

__version__ = "0.0.0-cpu-shim"

def flash_attn_varlen_qkvpacked_func(qkv, cu_seqlens, max_seqlen=None, dropout_p=0.0,
                                     softmax_scale=None, causal=False, **kw):
    """qkv: (total, 3, H, D); cu_seqlens: (B+1,) int. Returns (total, H, D).
    Sequences of equal length are batched together for speed."""
    dtype = qkv.dtype
    qkv = qkv.float()
    total, _, H, D = qkv.shape
    out = torch.empty(total, H, D, dtype=qkv.dtype, device=qkv.device)
    cu = cu_seqlens.to(torch.long)
    starts, lens = cu[:-1], cu[1:] - cu[:-1]
    for L in torch.unique(lens).tolist():
        if L == 0:
            continue
        s = starts[lens == L]                                   # (n,)
        idx = (s[:, None] + torch.arange(L, device=qkv.device)[None, :]).reshape(-1)
        x = qkv[idx].view(-1, L, 3, H, D)                       # (n, L, 3, H, D)
        q, k, v = (x[:, :, i].transpose(1, 2) for i in range(3))  # (n, H, L, D)
        o = F.scaled_dot_product_attention(q, k, v, is_causal=causal, scale=softmax_scale)
        out[idx] = o.transpose(1, 2).reshape(-1, H, D)
    return out.to(dtype)
