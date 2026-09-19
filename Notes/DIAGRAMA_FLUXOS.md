##Diagrama de Fluxo - Regras de Negócio

@startuml
start

:Usuário acessa o sistema;
:Informa CPF;

if (CPF encontrado?) then (Não)
  :Exibir formulário de inscrição;
  :Usuário preenche dados;

  if (Idade <= 8?) then (Sim)
    :Ativar modalidade Festival;
    :Solicitar dados do responsável;
  endif

  :Criar participante (status = pending);
else (Sim)
  if (Status = paid?) then (Sim)
    :Exibir confirmação de inscrição;
    stop
  else (Não)
    :Exibir dados da inscrição;
  endif
endif

:Usuário clica em "Pagar Inscrição";

if (Existe pagamento pending?) then (Sim)
  :Reutilizar PIX existente;
else (Não)
  :Criar PIX no Mercado Pago;
  :Salvar pagamento pending;
endif

:Exibir PIX copia e cola;
:Usuário realiza pagamento;

stop
@enduml

---------------------------------------------------------------------------------------------------

Descrição Textual — Diagrama de Fluxo

O diagrama de fluxo representa o comportamento funcional do sistema do ponto de vista do usuário, descrevendo as etapas percorridas desde o acesso inicial até a conclusão do pagamento da inscrição.

O fluxo inicia com o usuário acessando o sistema e informando o CPF do atleta. O sistema verifica a existência de uma inscrição associada a esse CPF. Caso o CPF não seja encontrado, o usuário é direcionado para o formulário de inscrição, onde preenche os dados do atleta.

Durante o preenchimento do formulário, o sistema verifica a idade informada. Caso o atleta seja menor de idade, o sistema ativa automaticamente a modalidade Festival e solicita os dados do responsável legal, garantindo conformidade com as regras do evento. Após o preenchimento correto das informações, a inscrição é criada com o status pending.

Se o CPF informado já estiver cadastrado, o sistema verifica o status da inscrição. Caso o status seja paid, é exibida uma confirmação informando que a inscrição já foi concluída. Caso o status seja pending, o sistema apresenta os dados da inscrição e disponibiliza a opção de pagamento.

Ao optar pelo pagamento, o sistema verifica se já existe um pagamento pendente associado à inscrição. Se existir, o código PIX previamente gerado é reutilizado. Caso contrário, um novo pagamento é criado no gateway de pagamento e armazenado no banco de dados. O sistema então exibe o código PIX no formato “copia e cola” para que o usuário possa realizar o pagamento.

Esse fluxo garante simplicidade, rastreabilidade e segurança, além de evitar cobranças duplicadas e manter a consistência entre inscrição e pagamento.