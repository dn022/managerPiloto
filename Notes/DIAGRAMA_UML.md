##Diagrama de Componentes - Arquitetura do Projeto

@startuml
skinparam style strictuml
skinparam componentStyle rectangle

package "Frontend (Next.js App Router)" {

  component "HomePage (/)" as Home
  component "CheckCpfPage (/check-cpf)" as CheckCPF
  component "InscricaoPage (/inscricao)" as Inscricao
  component "CashPage (/cash)\nPIX Inline" as Cash

  component "UI Components\n(Input, Button, Select, Checkbox)" as UI
}

package "API Routes (/api)" {

  component "POST /participantes/by-cpf" as ApiByCpf
  component "POST /participantes/create" as ApiCreateParticipant
  component "POST /payments/pix" as ApiPix
}

package "Backend Services" {

  component "Supabase\n(PostgreSQL)" as Supabase
  component "Mercado Pago\nPIX API" as MercadoPago
}

package "Database Tables" {

  entity "participantes" {
    id
    full_name
    cpf
    age
    academy
    belt_color
    gender
    category
    weight_kg
    mod_gi
    mod_nogi
    mod_gi_extra
    responsavel_nome
    responsavel_cpf
    responsavel_telefone
    status
    valor_inscricao
    created_at
  }

  entity "payments" {
    id
    registration_id
    gateway
    gateway_payment_id
    amount_cents
    status
    pix_copy_paste
    created_at
  }
}

' === FLUXO FRONTEND ===
Home --> CheckCPF
CheckCPF --> Inscricao : CPF não encontrado
CheckCPF --> Cash : CPF encontrado\nstatus = pending
CheckCPF --> Home : CPF encontrado\nstatus = paid

Inscricao --> ApiCreateParticipant
Cash --> ApiPix

' === API → BACKEND ===
ApiByCpf --> Supabase
ApiCreateParticipant --> Supabase
ApiPix --> Supabase
ApiPix --> MercadoPago

' === DATABASE ===
Supabase --> participantes
Supabase --> payments

@enduml

------------------------------------------------------------------------------------

Descrição Textual — Diagrama UML de Componentes

O diagrama de componentes apresenta a arquitetura geral do sistema de gestão de campeonatos de Jiu-Jitsu, evidenciando a separação entre frontend, backend, serviços externos e banco de dados.

No Frontend, desenvolvido em Next.js utilizando o App Router, estão representadas as principais páginas do sistema:

HomePage, responsável pelo acesso inicial;

CheckCpfPage, que realiza a consulta de inscrição a partir do CPF do atleta;

InscricaoPage, utilizada para o cadastro de novos participantes;

CashPage, responsável pela exibição do pagamento via PIX de forma inline.

Esses componentes utilizam um conjunto de componentes de interface reutilizáveis, como inputs, botões, seletores e checkboxes, garantindo padronização visual e consistência de interação.

O Backend é representado pelas rotas internas da aplicação (API Routes), que concentram toda a lógica de negócio. As principais rotas são:

a rota de consulta de participante por CPF;

a rota de criação de inscrições;

a rota de geração de pagamentos via PIX.

Essas rotas se comunicam diretamente com o Supabase, que atua como a fonte única da verdade do sistema, armazenando os dados de inscrições e pagamentos. Para o processamento dos pagamentos, o backend integra-se ao serviço externo Mercado Pago, responsável pela geração do código PIX no formato “copia e cola”.

Por fim, o diagrama evidencia as tabelas do banco de dados, destacando a relação entre participantes e pagamentos, reforçando a separação conceitual entre inscrição e pagamento e garantindo rastreabilidade e controle do fluxo financeiro.