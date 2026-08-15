(function () {
  'use strict';

  var VERSAO = '2026.08.15.1';
  var CHAVES_STATUS = ['STATUS DE ACESSO', 'STATUS_ACESSO', 'STATUSACESSO', 'ACESSO STATUS'];
  var CHAVES_VINCULO_NOVO = ['VÍNCULO OPERACIONAL', 'VINCULO OPERACIONAL', 'VINCULO_OPERACIONAL', 'VINCULOOPERACIONAL'];
  var CHAVES_VINCULO_LEGADO = ['VINCULO'];

  function canonico(valor) {
    return String(valor == null ? '' : valor)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ª/g, 'A')
      .replace(/[º°]/g, 'O')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }

  function mapaChaves(objeto) {
    var mapa = Object.create(null);
    if (!objeto || typeof objeto !== 'object') return mapa;
    Object.keys(objeto).forEach(function (chave) {
      mapa[canonico(chave)] = chave;
    });
    return mapa;
  }

  function obterCampo(objeto, aliases) {
    var mapa = mapaChaves(objeto);
    for (var i = 0; i < aliases.length; i += 1) {
      var chaveReal = mapa[canonico(aliases[i])];
      if (chaveReal) {
        return { presente: true, chave: chaveReal, valor: objeto[chaveReal] };
      }
    }
    return { presente: false, chave: '', valor: '' };
  }

  function normalizarStatus(valor) {
    var c = canonico(valor);
    if (c === 'ATIVO') return 'ATIVO';
    if (c === 'BLOQUEADO') return 'BLOQUEADO';
    if (c === 'TRANSFERIDO') return 'TRANSFERIDO';
    if (c === 'INATIVO') return 'INATIVO';
    return c ? 'DESCONHECIDO' : '';
  }

  function normalizarVinculo(valor) {
    var c = canonico(valor);
    if (!c) return '';

    if (
      c === 'EFETIVO' ||
      c === 'EFETIVO 3 CIA' ||
      c === 'EFETIVO 3A CIA' ||
      c === 'EFETIVO 3 CIA 19 BPM' ||
      c === 'EFETIVO 3A CIA 19O BPM'
    ) return 'EFETIVO_3_CIA';

    if (
      c === 'ACESSO 19 BPM' ||
      c === 'ACESSO 19O BPM' ||
      c === 'VINCULADO 19 BPM' ||
      c === 'VINCULADO 19O BPM'
    ) return 'VINCULADO_19_BPM';

    if (
      c === 'FORA 19 BPM' ||
      c === 'FORA 19O BPM' ||
      c === 'FORA DO 19 BPM' ||
      c === 'FORA DO 19O BPM'
    ) return 'FORA_19_BPM';

    return 'DESCONHECIDO';
  }

  function avaliar(usuario) {
    if (!usuario || typeof usuario !== 'object') {
      return { permitido: true, legado: true, status: '', vinculo: '', motivo: '', codigo: 'SEM_USUARIO' };
    }

    var statusCampo = obterCampo(usuario, CHAVES_STATUS);
    var vinculoNovo = obterCampo(usuario, CHAVES_VINCULO_NOVO);
    var vinculoLegado = vinculoNovo.presente ? { presente: false } : obterCampo(usuario, CHAVES_VINCULO_LEGADO);
    var status = normalizarStatus(statusCampo.valor);
    var vinculo = normalizarVinculo(vinculoNovo.presente ? vinculoNovo.valor : vinculoLegado.valor);

    if (status === 'BLOQUEADO') {
      return { permitido: false, legado: false, status: status, vinculo: vinculo, motivo: 'Acesso bloqueado administrativamente.', codigo: 'STATUS_BLOQUEADO' };
    }
    if (status === 'TRANSFERIDO') {
      return { permitido: false, legado: false, status: status, vinculo: vinculo, motivo: 'Acesso bloqueado: cadastro marcado como transferido.', codigo: 'STATUS_TRANSFERIDO' };
    }
    if (status === 'INATIVO') {
      return { permitido: false, legado: false, status: status, vinculo: vinculo, motivo: 'Acesso bloqueado: cadastro inativo.', codigo: 'STATUS_INATIVO' };
    }
    if (statusCampo.presente && status === 'DESCONHECIDO') {
      return { permitido: false, legado: false, status: status, vinculo: vinculo, motivo: 'Acesso bloqueado: STATUS DE ACESSO inválido no cadastro mestre.', codigo: 'STATUS_INVALIDO' };
    }
    if (vinculo === 'FORA_19_BPM') {
      return { permitido: false, legado: false, status: status, vinculo: vinculo, motivo: 'Acesso bloqueado: vínculo operacional fora do 19º BPM.', codigo: 'FORA_19_BPM' };
    }
    if (vinculoNovo.presente && vinculo === 'DESCONHECIDO') {
      return { permitido: false, legado: false, status: status, vinculo: vinculo, motivo: 'Acesso bloqueado: VÍNCULO OPERACIONAL inválido no cadastro mestre.', codigo: 'VINCULO_INVALIDO' };
    }

    if (status === 'ATIVO' && (vinculo === 'EFETIVO_3_CIA' || vinculo === 'VINCULADO_19_BPM')) {
      return { permitido: true, legado: false, status: status, vinculo: vinculo, motivo: '', codigo: 'ATIVO_ELEGIVEL' };
    }

    // Migração segura: enquanto a API ainda não devolver um dos novos campos,
    // preserva o fluxo legado. Campos novos explícitos e inválidos falham fechados.
    var migracao = !statusCampo.presente || (!vinculoNovo.presente && !vinculoLegado.presente) || vinculo === 'DESCONHECIDO';
    return { permitido: true, legado: migracao, status: status, vinculo: vinculo, motivo: '', codigo: migracao ? 'MIGRACAO_LEGADA' : 'ELEGIVEL' };
  }

  function notificar(mensagem, tipo) {
    try {
      if (typeof toast === 'function') {
        toast(mensagem, tipo || 'aviso');
        return;
      }
    } catch (_) {}
    try {
      if (typeof mostrarToast === 'function') {
        mostrarToast(mensagem, tipo || 'aviso');
        return;
      }
    } catch (_) {}
    try { window.alert(mensagem); } catch (_) {}
  }

  function encerrarSessaoPorGovernanca(decisao) {
    try {
      if (typeof CHAVE_SESSAO_SIGA !== 'undefined') sessionStorage.removeItem(CHAVE_SESSAO_SIGA);
    } catch (_) {}
    try {
      if (typeof registrarAtividadeSessao === 'function') registrarAtividadeSessao(false);
    } catch (_) {}
    try {
      if (typeof estado !== 'undefined' && estado) {
        estado.token = '';
        estado.usuario = null;
        estado.configuracao = null;
        estado.rotinasAdminAquecidas = false;
      }
    } catch (_) {}
    try {
      if (typeof voltarParaAcesso === 'function') voltarParaAcesso();
    } catch (_) {}
    try {
      if (typeof ocultarCarregando === 'function') ocultarCarregando();
    } catch (_) {}
    notificar(decisao.motivo || 'Acesso não autorizado pelo cadastro mestre.', 'erro');
  }

  function instalarGuardas() {
    var instalados = [];

    try {
      if (typeof configurarAplicacao === 'function' && !configurarAplicacao.__sigaGovernanca) {
        var configurarOriginal = configurarAplicacao;
        var configurarProtegida = async function () {
          var decisao = avaliar(typeof estado !== 'undefined' ? estado.usuario : null);
          if (!decisao.permitido) {
            encerrarSessaoPorGovernanca(decisao);
            var erro = new Error(decisao.motivo || 'Acesso negado.');
            erro.codigo = 'SIGA_ACESSO_NEGADO_' + decisao.codigo;
            throw erro;
          }
          if (decisao.legado && typeof console !== 'undefined' && console.warn) {
            console.warn('[SIGA] Governança de acesso em modo de migração: API ainda não expôs todos os campos de vínculo/status.');
          }
          return configurarOriginal.apply(this, arguments);
        };
        configurarProtegida.__sigaGovernanca = true;
        configurarAplicacao = configurarProtegida;
        instalados.push('configurarAplicacao');
      }
    } catch (erroConfig) {
      console.error('[SIGA] Falha ao proteger configurarAplicacao:', erroConfig);
    }

    try {
      if (typeof temPermissaoAdmin === 'function' && !temPermissaoAdmin.__sigaGovernanca) {
        var permissaoOriginal = temPermissaoAdmin;
        var permissaoProtegida = function () {
          var decisao = avaliar(typeof estado !== 'undefined' ? estado.usuario : null);
          if (!decisao.permitido) return false;
          return permissaoOriginal.apply(this, arguments);
        };
        permissaoProtegida.__sigaGovernanca = true;
        temPermissaoAdmin = permissaoProtegida;
        instalados.push('temPermissaoAdmin');
      }
    } catch (erroPermissao) {
      console.error('[SIGA] Falha ao proteger temPermissaoAdmin:', erroPermissao);
    }

    try {
      if (typeof usuarioPodeUsarAreaComum === 'function' && !usuarioPodeUsarAreaComum.__sigaGovernanca) {
        var areaOriginal = usuarioPodeUsarAreaComum;
        var areaProtegida = function () {
          var decisao = avaliar(typeof estado !== 'undefined' ? estado.usuario : null);
          if (!decisao.permitido) return false;
          return areaOriginal.apply(this, arguments);
        };
        areaProtegida.__sigaGovernanca = true;
        usuarioPodeUsarAreaComum = areaProtegida;
        instalados.push('usuarioPodeUsarAreaComum');
      }
    } catch (erroArea) {
      console.error('[SIGA] Falha ao proteger usuarioPodeUsarAreaComum:', erroArea);
    }

    try {
      if (typeof selecionarPolicialSetorAdmin === 'function' && !selecionarPolicialSetorAdmin.__sigaGovernanca) {
        var selecionarOriginal = selecionarPolicialSetorAdmin;
        var selecionarProtegida = function (id) {
          var lista = (typeof estado !== 'undefined' && estado.policiaisAcessoSetor) || [];
          var policial = lista.find(function (p) { return String(p.id) === String(id); });
          var decisao = avaliar(policial);
          if (policial && !decisao.permitido) {
            try { estado.setorPolicialSelecionado = null; } catch (_) {}
            notificar(decisao.motivo, 'aviso');
            return;
          }
          return selecionarOriginal.apply(this, arguments);
        };
        selecionarProtegida.__sigaGovernanca = true;
        selecionarPolicialSetorAdmin = selecionarProtegida;
        instalados.push('selecionarPolicialSetorAdmin');
      }
    } catch (erroSelecionar) {
      console.error('[SIGA] Falha ao proteger selecionarPolicialSetorAdmin:', erroSelecionar);
    }

    try {
      if (typeof salvarAcessoSetorAdmin === 'function' && !salvarAcessoSetorAdmin.__sigaGovernanca) {
        var salvarOriginal = salvarAcessoSetorAdmin;
        var salvarProtegida = async function () {
          var selecionado = (typeof estado !== 'undefined' && estado) ? estado.setorPolicialSelecionado : null;
          var decisao = avaliar(selecionado);
          if (selecionado && !decisao.permitido) {
            var evento = arguments[0];
            try { if (evento && evento.preventDefault) evento.preventDefault(); } catch (_) {}
            notificar(decisao.motivo, 'aviso');
            return;
          }
          return salvarOriginal.apply(this, arguments);
        };
        salvarProtegida.__sigaGovernanca = true;
        salvarAcessoSetorAdmin = salvarProtegida;
        instalados.push('salvarAcessoSetorAdmin');
      }
    } catch (erroSalvar) {
      console.error('[SIGA] Falha ao proteger salvarAcessoSetorAdmin:', erroSalvar);
    }

    return instalados;
  }

  var apiGovernanca = Object.freeze({
    versao: VERSAO,
    avaliar: avaliar,
    normalizarStatus: normalizarStatus,
    normalizarVinculo: normalizarVinculo,
    instalarGuardas: instalarGuardas
  });

  try {
    Object.defineProperty(window, 'SIGAGovernancaAcesso', {
      value: apiGovernanca,
      configurable: false,
      enumerable: false,
      writable: false
    });
  } catch (_) {
    window.SIGAGovernancaAcesso = apiGovernanca;
  }

  var instalados = instalarGuardas();
  if (typeof console !== 'undefined' && console.info) {
    console.info('[SIGA] Governança de acesso ' + VERSAO + ' ativa:', instalados.join(', ') || 'sem hooks');
  }
}());
