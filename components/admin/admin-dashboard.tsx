'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import {
  assignCode,
  createCodes,
  deleteCode,
  setCodeStatus,
  setOrderStatus,
  syncUsedCodes,
} from '@/app/actions/admin'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { StatusBadge } from '@/components/status-badge'
import { formatBRL, formatDate } from '@/lib/format'

type Customer = {
  id: string
  email: string | null
  full_name: string | null
  created_at: string
  codeCount: number
  orderCount: number
}

type Code = {
  id: string
  code: string
  status: string
  created_at: string
  assigned_at: string | null
  user_id: string | null
  userEmail: string | null
  productName: string | null
  productId: string | null
  orderId: string | null
}

type Order = {
  id: string
  status: string
  total_cents: number
  created_at: string
  userEmail: string | null
  productName: string | null
}

type ProductOption = {
  id: string
  name: string
}

type CustomerOption = {
  id: string
  label: string
}

type ActionResult =
  | {
      ok: true
      message?: string
    }
  | {
      ok: false
      error: string
    }

type SyncResult =
  | {
      ok: true
      found: number
      updated: number
      notFound: string[]
      message: string
    }
  | {
      ok: false
      error: string
    }

type CodeFilter =
  | 'all'
  | 'available'
  | 'delivered'
  | 'used'

export function AdminDashboard({
  customers,
  codes,
  orders,
  productOptions: _productOptions,
  customerOptions,
}: {
  customers: Customer[]
  codes: Code[]
  orders: Order[]
  productOptions: ProductOption[]
  customerOptions: CustomerOption[]
}) {
  const router = useRouter()

  const [isPending, startTransition] = useTransition()
  const [isSyncing, startSyncTransition] =
    useTransition()

  const [syncResult, setSyncResult] =
    useState<Extract<SyncResult, { ok: true }> | null>(
      null,
    )

  /*
   * =========================================================
   * BUSCA E FILTROS
   * =========================================================
   */

  const [codeSearch, setCodeSearch] =
    useState('')

  const [codeFilter, setCodeFilter] =
    useState<CodeFilter>('all')

  function handleAction(
    action: (
      formData: FormData,
    ) => Promise<ActionResult>,
    formData: FormData,
    form?: HTMLFormElement,
  ) {
    startTransition(() => {
      void action(formData)
        .then((result) => {
          if (result.ok) {
            toast.success(
              result.message ??
                'Ação realizada com sucesso.',
            )

            form?.reset()
            router.refresh()
            return
          }

          toast.error(
            result.error ??
              'Não foi possível concluir a ação.',
          )
        })
        .catch((error) => {
          console.error(
            'Erro na ação administrativa:',
            error,
          )

          toast.error(
            'Ocorreu um erro inesperado.',
          )
        })
    })
  }

  async function handleCopyAllDelivered() {
    const deliveredCodes = codes
      .filter((code) => !!code.user_id)
      .map((code) => code.code)
      .filter(Boolean)

    if (deliveredCodes.length === 0) {
      toast.error(
        'Não existem códigos entregues para copiar.',
      )
      return
    }

    const text = deliveredCodes.join('\n')

    try {
      await navigator.clipboard.writeText(text)

      toast.success(
        `${deliveredCodes.length} código(s) entregues copiado(s).`,
      )
    } catch (error) {
      console.error(
        'Erro ao copiar códigos entregues:',
        error,
      )

      toast.error(
        'Não foi possível copiar os códigos. Verifique a permissão da área de transferência.',
      )
    }
  }

  function handleSyncUsedCodes(
    form: HTMLFormElement,
  ) {
    const formData = new FormData(form)

    setSyncResult(null)

    startSyncTransition(() => {
      void syncUsedCodes(formData)
        .then((result) => {
          if (!result.ok) {
            toast.error(result.error)
            return
          }

          setSyncResult(result)

          toast.success(
            result.message,
          )

          form.reset()
          router.refresh()
        })
        .catch((error) => {
          console.error(
            'Erro na sincronização de códigos:',
            error,
          )

          toast.error(
            'Ocorreu um erro inesperado ao sincronizar os códigos.',
          )
        })
    })
  }

  /*
   * =========================================================
   * ESTATÍSTICAS
   * =========================================================
   */

  const stats = useMemo(() => {
    const total = codes.length

    const available = codes.filter(
      (code) =>
        code.status === 'active' &&
        !code.user_id,
    ).length

    const delivered = codes.filter(
      (code) => !!code.user_id,
    ).length

    const inactive = codes.filter(
      (code) =>
        code.status === 'inactive',
    ).length

    const used = codes.filter(
      (code) =>
        code.status === 'used',
    ).length

    return {
      total,
      available,
      delivered,
      inactive,
      used,
    }
  }, [codes])

  /*
   * =========================================================
   * CÓDIGOS
   * =========================================================
   */

  const availableCodes = useMemo(
    () =>
      codes.filter(
        (code) =>
          !code.user_id &&
          code.status === 'active',
      ),
    [codes],
  )

  const deliveredCodes = useMemo(
    () =>
      codes.filter(
        (code) =>
          !!code.user_id,
      ),
    [codes],
  )

  /*
   * =========================================================
   * CÓDIGOS FILTRADOS
   *
   * Busca por:
   * - código
   * - cliente/e-mail
   * - pedido
   * =========================================================
   */

  const filteredCodes = useMemo(() => {
    const search = codeSearch
      .trim()
      .toLowerCase()

    return codes.filter((code) => {
      /*
       * FILTRO POR STATUS
       */

      if (codeFilter === 'available') {
        if (
          code.status !== 'active' ||
          !!code.user_id
        ) {
          return false
        }
      }

      if (codeFilter === 'delivered') {
        if (!code.user_id) {
          return false
        }
      }

      if (codeFilter === 'used') {
        if (code.status !== 'used') {
          return false
        }
      }

      /*
       * SEM BUSCA
       */

      if (!search) {
        return true
      }

      /*
       * CAMPOS PESQUISÁVEIS
       */

      const searchableText = [
        code.code,
        code.userEmail,
        code.orderId,
        code.productName,
        code.user_id,
        code.id,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return searchableText.includes(search)
    })
  }, [codes, codeFilter, codeSearch])

  /*
   * =========================================================
   * CONTADORES DOS FILTROS
   * =========================================================
   */

  const filterCounts = useMemo(() => {
    return {
      all: codes.length,

      available: codes.filter(
        (code) =>
          code.status === 'active' &&
          !code.user_id,
      ).length,

      delivered: codes.filter(
        (code) =>
          !!code.user_id,
      ).length,

      used: codes.filter(
        (code) =>
          code.status === 'used',
      ).length,
    }
  }, [codes])

  /*
   * =========================================================
   * STATUS VISUAL
   * =========================================================
   */

  function getCodeStatusLabel(
    status: string,
  ) {
    switch (status) {
      case 'used':
        return 'USADO'

      case 'active':
        return 'ATIVO'

      case 'inactive':
        return 'DESATIVADO'

      default:
        return status.toUpperCase()
    }
  }

  function getCodeStatusClasses(
    status: string,
  ) {
    switch (status) {
      case 'used':
        return 'border-orange-500/20 bg-orange-500/10 text-orange-600'

      case 'active':
        return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600'

      case 'inactive':
        return 'border-red-500/20 bg-red-500/10 text-red-600'

      default:
        return 'border-border bg-muted text-muted-foreground'
    }
  }

  return (
    <div className="space-y-10">

      {/* =====================================================
          RESUMO DO ESTOQUE
      ====================================================== */}

      <section>
        <h2 className="text-lg font-semibold">
          Resumo do estoque
        </h2>

        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

          <div className="rounded-xl border border-border/60 bg-card p-5">
            <p className="text-sm text-muted-foreground">
              Total de códigos
            </p>

            <p className="mt-2 text-3xl font-bold">
              {stats.total}
            </p>
          </div>

          <div className="rounded-xl border border-border/60 bg-card p-5">
            <p className="text-sm text-muted-foreground">
              Disponíveis
            </p>

            <p className="mt-2 text-3xl font-bold text-green-500">
              {stats.available}
            </p>
          </div>

          <div className="rounded-xl border border-border/60 bg-card p-5">
            <p className="text-sm text-muted-foreground">
              Entregues a clientes
            </p>

            <p className="mt-2 text-3xl font-bold">
              {stats.delivered}
            </p>
          </div>

          <div className="rounded-xl border border-border/60 bg-card p-5">
            <p className="text-sm text-muted-foreground">
              Usados
            </p>

            <p className="mt-2 text-3xl font-bold text-orange-500">
              {stats.used}
            </p>
          </div>

        </div>

        {stats.inactive > 0 && (
          <p className="mt-3 text-sm text-muted-foreground">
            {stats.inactive} código(s) desativado(s).
          </p>
        )}
      </section>


      {/* =====================================================
          ADICIONAR CÓDIGOS
      ====================================================== */}

      <section className="rounded-xl border border-border/60 bg-card p-5">

        <h2 className="text-lg font-semibold">
          Adicionar códigos ao estoque
        </h2>

        <p className="mt-1 text-sm text-muted-foreground">
          Todos os códigos entram no mesmo estoque geral.
          Cole um código por linha.
        </p>

        <form
          className="mt-4 space-y-4"
          onSubmit={(e) => {
            e.preventDefault()

            const form = e.currentTarget
            const formData = new FormData(form)

            handleAction(
              createCodes,
              formData,
              form,
            )
          }}
        >
          <div>
            <Label htmlFor="codes">
              Códigos
            </Label>

            <textarea
              id="codes"
              name="codes"
              required
              disabled={isPending}
              className="mt-1 min-h-40 w-full rounded-md border bg-background p-3 font-mono text-sm"
              placeholder={`CODIGO-001
CODIGO-002
CODIGO-003`}
            />
          </div>

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={isPending}
            >
              {isPending
                ? 'Adicionando...'
                : 'Adicionar ao estoque'}
            </Button>
          </div>
        </form>

      </section>


      {/* =====================================================
          CLIENTES
      ====================================================== */}

      <section>

        <h2 className="text-lg font-semibold">
          Clientes ({customers.length})
        </h2>

        <div className="mt-3 overflow-x-auto rounded-xl border border-border/60">

          <table className="w-full text-sm">

            <thead className="bg-card text-left text-muted-foreground">
              <tr>

                <th className="px-4 py-3">
                  Cliente
                </th>

                <th className="px-4 py-3">
                  Códigos
                </th>

                <th className="px-4 py-3">
                  Pedidos
                </th>

                <th className="px-4 py-3">
                  Cadastro
                </th>

              </tr>
            </thead>

            <tbody>

              {customers.map((customer) => (
                <tr
                  key={customer.id}
                  className="border-t"
                >

                  <td className="px-4 py-3">
                    {customer.email ??
                      customer.full_name ??
                      customer.id}
                  </td>

                  <td className="px-4 py-3">
                    {customer.codeCount}
                  </td>

                  <td className="px-4 py-3">
                    {customer.orderCount}
                  </td>

                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDate(
                      customer.created_at,
                    )}
                  </td>

                </tr>
              ))}

            </tbody>

          </table>

        </div>

      </section>


      {/* =====================================================
          CÓDIGOS DISPONÍVEIS
      ====================================================== */}

      <section>

        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">

          <div>

            <h2 className="text-lg font-semibold">
              Códigos disponíveis ({availableCodes.length})
            </h2>

            <p className="text-sm text-muted-foreground">
              Códigos que ainda estão no estoque e podem
              ser entregues em novas compras.
            </p>

          </div>

          <div className="text-sm font-medium text-green-500">
            {stats.available} disponíveis
          </div>

        </div>

        <div className="mt-3 space-y-3">

          {availableCodes.length === 0 ? (

            <div className="rounded-xl border border-border/60 bg-card p-6 text-center text-sm text-muted-foreground">
              Nenhum código disponível no estoque.
            </div>

          ) : (

            availableCodes.map((code) => (

              <div
                key={code.id}
                className="rounded-xl border border-border/60 bg-card p-4"
              >

                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

                  <div className="min-w-0">

                    <div className="flex flex-wrap items-center gap-2">

                      <code className="rounded bg-secondary px-2 py-1 font-mono text-sm">
                        {code.code}
                      </code>

                      <StatusBadge
                        status={code.status}
                        type="code"
                      />

                      {code.status === 'active' && (
                        <span className="text-xs font-medium text-green-500">
                          Disponível
                        </span>
                      )}

                    </div>

                    <p className="mt-2 text-xs text-muted-foreground">
                      Disponível no estoque
                    </p>

                    <p className="mt-1 text-xs text-muted-foreground">
                      Adicionado em{' '}
                      {formatDate(
                        code.created_at,
                      )}
                    </p>

                  </div>

                  <div className="flex flex-wrap gap-2">

                    <form
                      onSubmit={(e) => {
                        e.preventDefault()

                        const form =
                          e.currentTarget

                        handleAction(
                          assignCode,
                          new FormData(form),
                          form,
                        )
                      }}
                    >

                      <input
                        type="hidden"
                        name="codeId"
                        value={code.id}
                      />

                      <select
                        name="userId"
                        defaultValue=""
                        disabled={isPending}
                        className="h-9 rounded-md border bg-background px-2 text-sm"
                      >

                        <option value="">
                          Não atribuído
                        </option>

                        {customerOptions.map(
                          (user) => (
                            <option
                              key={user.id}
                              value={user.id}
                            >
                              {user.label}
                            </option>
                          ),
                        )}

                      </select>

                      <Button
                        type="submit"
                        size="sm"
                        variant="secondary"
                        disabled={isPending}
                        className="ml-2"
                      >
                        Atribuir
                      </Button>

                    </form>

                    <form
                      onSubmit={(e) => {
                        e.preventDefault()

                        const form =
                          e.currentTarget

                        handleAction(
                          setCodeStatus,
                          new FormData(form),
                          form,
                        )
                      }}
                    >

                      <input
                        type="hidden"
                        name="codeId"
                        value={code.id}
                      />

                      <input
                        type="hidden"
                        name="status"
                        value={
                          code.status === 'active'
                            ? 'inactive'
                            : 'active'
                        }
                      />

                      <Button
                        type="submit"
                        size="sm"
                        variant="outline"
                        disabled={isPending}
                      >
                        {code.status === 'active'
                          ? 'Desativar'
                          : 'Ativar'}
                      </Button>

                    </form>

                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={isPending}
                      onClick={() => {
                        const confirmed =
                          window.confirm(
                            `Excluir o código ${code.code}?`,
                          )

                        if (!confirmed) {
                          return
                        }

                        const formData =
                          new FormData()

                        formData.append(
                          'codeId',
                          code.id,
                        )

                        handleAction(
                          deleteCode,
                          formData,
                        )
                      }}
                    >
                      Excluir
                    </Button>

                  </div>

                </div>

              </div>

            ))

          )}

        </div>

      </section>


      {/* =====================================================
          CÓDIGOS ENTREGUES
      ====================================================== */}

      <section>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

          <div>

            <h2 className="text-lg font-semibold">
              Códigos entregues ({deliveredCodes.length})
            </h2>

            <p className="text-sm text-muted-foreground">
              Histórico dos códigos que já foram entregues
              aos clientes.
            </p>

          </div>

          <div className="flex flex-wrap items-center gap-2">

            <div className="text-sm text-muted-foreground">
              {deliveredCodes.length} entregues
            </div>

            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={
                isPending ||
                deliveredCodes.length === 0
              }
              onClick={handleCopyAllDelivered}
            >
              Copiar todos entregues
            </Button>

          </div>

        </div>


        {/* ===================================================
            SINCRONIZAÇÃO DE CÓDIGOS USADOS
        ==================================================== */}

        <div className="mt-5 rounded-xl border border-orange-500/20 bg-orange-500/5 p-5">

          <div>

            <h3 className="text-base font-semibold">
              Sincronizar códigos usados
            </h3>

            <p className="mt-1 text-sm text-muted-foreground">
              Cole os códigos que já foram utilizados.
              O sistema vai procurar somente códigos que
              já existem no estoque e marcá-los como USADO.
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              Você pode colar um por linha, separados por
              vírgula ou ponto e vírgula. Nenhum código novo
              será criado.
            </p>

          </div>

          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault()

              const form = e.currentTarget

              handleSyncUsedCodes(form)
            }}
          >

            <Label htmlFor="used-codes">
              Códigos usados
            </Label>

            <textarea
              id="used-codes"
              name="codes"
              required
              disabled={isSyncing}
              className="min-h-48 w-full rounded-md border bg-background p-3 font-mono text-sm"
              placeholder={`B4L3I4Z6X1V0M8R2
N0Y7K6N8D0G7H6F2
G0V7S4N0M5M6C0R5`}
            />

            <div className="flex justify-end">

              <Button
                type="submit"
                disabled={isSyncing}
                variant="outline"
              >
                {isSyncing
                  ? 'Sincronizando...'
                  : 'Marcar códigos como usados'}
              </Button>

            </div>

          </form>

          {syncResult && (
            <div className="mt-4 rounded-lg border border-border bg-card p-4">

              <p className="text-sm font-semibold">
                Sincronização concluída
              </p>

              <div className="mt-3 grid gap-3 sm:grid-cols-3">

                <div>
                  <p className="text-xs text-muted-foreground">
                    Encontrados
                  </p>

                  <p className="text-lg font-bold">
                    {syncResult.found}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">
                    Atualizados
                  </p>

                  <p className="text-lg font-bold text-orange-500">
                    {syncResult.updated}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">
                    Não encontrados
                  </p>

                  <p className="text-lg font-bold text-red-500">
                    {syncResult.notFound.length}
                  </p>
                </div>

              </div>

              {syncResult.notFound.length > 0 && (
                <div className="mt-4">

                  <p className="text-xs font-semibold text-red-500">
                    Códigos não encontrados
                  </p>

                  <div className="mt-2 max-h-40 overflow-y-auto rounded-md border border-border bg-background p-3">

                    <pre className="whitespace-pre-wrap break-all font-mono text-xs">
                      {syncResult.notFound.join('\n')}
                    </pre>

                  </div>

                </div>
              )}

            </div>
          )}

        </div>


        {/* ===================================================
            LISTA DE ENTREGUES
        ==================================================== */}

        <div className="mt-3 space-y-3">

          {deliveredCodes.length === 0 ? (

            <div className="rounded-xl border border-border/60 bg-card p-6 text-center text-sm text-muted-foreground">
              Nenhum código foi entregue ainda.
            </div>

          ) : (

            deliveredCodes.map((code) => (

              <div
                key={code.id}
                className="rounded-xl border border-border/60 bg-card p-4"
              >

                <div className="grid gap-4 lg:grid-cols-[1.2fr_1.5fr_1fr_1fr_auto] lg:items-center">

                  <div>

                    <p className="mb-1 text-xs text-muted-foreground">
                      Código
                    </p>

                    <code className="rounded bg-secondary px-2 py-1 font-mono text-sm">
                      {code.code}
                    </code>

                  </div>

                  <div>

                    <p className="mb-1 text-xs text-muted-foreground">
                      Cliente
                    </p>

                    <p className="break-all text-sm font-medium">
                      {code.userEmail ??
                        'Cliente não identificado'}
                    </p>

                  </div>

                  <div>

                    <p className="mb-1 text-xs text-muted-foreground">
                      Produto
                    </p>

                    <p className="text-sm">
                      {code.productName ??
                        'Estoque geral'}
                    </p>

                  </div>

                  <div>

                    <p className="mb-1 text-xs text-muted-foreground">
                      Comprado em
                    </p>

                    <p className="text-sm">
                      {code.assigned_at
                        ? formatDate(
                            code.assigned_at,
                          )
                        : '—'}
                    </p>

                  </div>

                  <div className="flex flex-col gap-2 lg:items-end">

                    <span
                      className={`rounded-full border px-2 py-1 text-[10px] font-bold ${getCodeStatusClasses(
                        code.status,
                      )}`}
                    >
                      {getCodeStatusLabel(
                        code.status,
                      )}
                    </span>

                    {code.status !== 'used' && (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault()

                          const form =
                            e.currentTarget

                          const formData =
                            new FormData(form)

                          formData.set(
                            'status',
                            'used',
                          )

                          handleAction(
                            setCodeStatus,
                            formData,
                            form,
                          )
                        }}
                      >

                        <input
                          type="hidden"
                          name="codeId"
                          value={code.id}
                        />

                        <Button
                          type="submit"
                          size="sm"
                          variant="outline"
                          disabled={isPending}
                        >
                          {isPending
                            ? 'Atualizando...'
                            : 'Marcar como usado'}
                        </Button>

                      </form>
                    )}

                    {code.status === 'used' && (
                      <span className="text-xs font-medium text-orange-500">
                        Código já utilizado
                      </span>
                    )}

                  </div>

                </div>

              </div>
            ))

          )}

        </div>

      </section>


      {/* =====================================================
          GERENCIAMENTO / BUSCA DE CÓDIGOS
      ====================================================== */}

      <section>

        <div className="rounded-xl border border-border/60 bg-card p-5">

          <div className="flex flex-col gap-1">

            <h2 className="text-lg font-semibold">
              Gerenciar códigos
            </h2>

            <p className="text-sm text-muted-foreground">
              Pesquise por código, cliente, e-mail ou pedido
              e filtre por situação.
            </p>

          </div>


          {/* BUSCA */}

          <div className="mt-4">

            <Label htmlFor="code-search">
              Buscar
            </Label>

            <input
              id="code-search"
              type="text"
              value={codeSearch}
              onChange={(e) =>
                setCodeSearch(
                  e.target.value,
                )
              }
              placeholder="Código, cliente, e-mail ou ID do pedido..."
              className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none transition focus:ring-2 focus:ring-primary/30"
            />

          </div>


          {/* FILTROS */}

          <div className="mt-4 flex flex-wrap gap-2">

            <Button
              type="button"
              size="sm"
              variant={
                codeFilter === 'all'
                  ? 'default'
                  : 'outline'
              }
              onClick={() =>
                setCodeFilter('all')
              }
            >
              Todos ({filterCounts.all})
            </Button>

            <Button
              type="button"
              size="sm"
              variant={
                codeFilter === 'available'
                  ? 'default'
                  : 'outline'
              }
              onClick={() =>
                setCodeFilter('available')
              }
            >
              Disponíveis ({filterCounts.available})
            </Button>

            <Button
              type="button"
              size="sm"
              variant={
                codeFilter === 'delivered'
                  ? 'default'
                  : 'outline'
              }
              onClick={() =>
                setCodeFilter('delivered')
              }
            >
              Entregues ({filterCounts.delivered})
            </Button>

            <Button
              type="button"
              size="sm"
              variant={
                codeFilter === 'used'
                  ? 'default'
                  : 'outline'
              }
              onClick={() =>
                setCodeFilter('used')
              }
            >
              Usados ({filterCounts.used})
            </Button>

          </div>


          {/* RESULTADO */}

          <div className="mt-5 flex items-center justify-between gap-3">

            <p className="text-sm text-muted-foreground">
              {filteredCodes.length}{' '}
              {filteredCodes.length === 1
                ? 'resultado'
                : 'resultados'}
            </p>

            {(codeSearch ||
              codeFilter !== 'all') && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setCodeSearch('')
                  setCodeFilter('all')
                }}
              >
                Limpar filtros
              </Button>
            )}

          </div>


          {/* LISTA */}

          <div className="mt-3 space-y-3">

            {filteredCodes.length === 0 ? (

              <div className="rounded-xl border border-dashed border-border p-6 text-center">

                <p className="text-sm font-medium">
                  Nenhum código encontrado.
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  Tente outro termo ou remova os filtros.
                </p>

              </div>

            ) : (

              filteredCodes.map((code) => (

                <div
                  key={code.id}
                  className="rounded-xl border border-border/60 bg-background p-4"
                >

                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

                    <div className="min-w-0">

                      <div className="flex flex-wrap items-center gap-2">

                        <code className="rounded bg-secondary px-2 py-1 font-mono text-sm">
                          {code.code}
                        </code>

                        <span
                          className={`rounded-full border px-2 py-1 text-[10px] font-bold ${getCodeStatusClasses(
                            code.status,
                          )}`}
                        >
                          {getCodeStatusLabel(
                            code.status,
                          )}
                        </span>

                      </div>

                      <div className="mt-2 space-y-1 text-xs text-muted-foreground">

                        {code.userEmail && (
                          <p>
                            Cliente:{' '}
                            <span className="font-medium text-foreground">
                              {code.userEmail}
                            </span>
                          </p>
                        )}

                        {code.orderId && (
                          <p>
                            Pedido:{' '}
                            <span className="font-mono font-medium text-foreground">
                              #{code.orderId
                                .replaceAll('-', '')
                                .slice(0, 8)
                                .toUpperCase()}
                            </span>
                          </p>
                        )}

                        <p>
                          {code.assigned_at
                            ? `Comprado em ${formatDate(
                                code.assigned_at,
                              )}`
                            : `Adicionado em ${formatDate(
                                code.created_at,
                              )}`}
                        </p>

                      </div>

                    </div>

                    <div className="flex flex-wrap gap-2">

                      {code.status !== 'used' && (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault()

                            const form =
                              e.currentTarget

                            const formData =
                              new FormData(form)

                            formData.set(
                              'status',
                              'used',
                            )

                            handleAction(
                              setCodeStatus,
                              formData,
                              form,
                            )
                          }}
                        >

                          <input
                            type="hidden"
                            name="codeId"
                            value={code.id}
                          />

                          <Button
                            type="submit"
                            size="sm"
                            variant="outline"
                            disabled={isPending}
                          >
                            Marcar como usado
                          </Button>

                        </form>
                      )}

                    </div>

                  </div>

                </div>

              ))

            )}

          </div>

        </div>

      </section>


      {/* =====================================================
          PEDIDOS
      ====================================================== */}

      <section>

        <h2 className="text-lg font-semibold">
          Pedidos ({orders.length})
        </h2>

        <div className="mt-3 overflow-x-auto rounded-xl border border-border/60">

          <table className="w-full text-sm">

            <thead className="bg-card text-left text-muted-foreground">

              <tr>

                <th className="px-4 py-3">
                  Produto
                </th>

                <th className="px-4 py-3">
                  Cliente
                </th>

                <th className="px-4 py-3">
                  Valor
                </th>

                <th className="px-4 py-3">
                  Data
                </th>

                <th className="px-4 py-3">
                  Status
                </th>

              </tr>

            </thead>

            <tbody>

              {orders.map((order) => (

                <tr
                  key={order.id}
                  className="border-t"
                >

                  <td className="px-4 py-3">
                    {order.productName ??
                      'Plano'}
                  </td>

                  <td className="px-4 py-3">
                    {order.userEmail ?? '—'}
                  </td>

                  <td className="px-4 py-3">
                    {formatBRL(
                      order.total_cents,
                    )}
                  </td>

                  <td className="px-4 py-3">
                    {formatDate(
                      order.created_at,
                    )}
                  </td>

                  <td className="px-4 py-3">

                    <form
                      className="flex gap-2"
                      onSubmit={(e) => {
                        e.preventDefault()

                        const form =
                          e.currentTarget

                        handleAction(
                          setOrderStatus,
                          new FormData(form),
                          form,
                        )
                      }}
                    >

                      <input
                        type="hidden"
                        name="orderId"
                        value={order.id}
                      />

                      <select
                        name="status"
                        defaultValue={
                          order.status
                        }
                        disabled={isPending}
                        className="h-9 rounded-md border bg-background px-2 text-sm"
                      >

                        {[
                          'pending',
                          'paid',
                          'delivered',
                          'cancelled',
                        ].map((status) => (

                          <option
                            key={status}
                            value={status}
                          >
                            {status}
                          </option>

                        ))}

                      </select>

                      <Button
                        type="submit"
                        size="sm"
                        variant="secondary"
                        disabled={isPending}
                      >
                        Salvar
                      </Button>

                    </form>

                  </td>

                </tr>
              ))}

            </tbody>

          </table>

        </div>

      </section>

    </div>
  )
}
