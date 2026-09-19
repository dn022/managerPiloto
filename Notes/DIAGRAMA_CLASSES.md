##Diagrama de Classes - Modelagem de Dados

@startuml
skinparam classAttributeIconSize 0

class Participante {
  +id: UUID
  +full_name: String
  +cpf: String
  +age: Integer
  +academy: String
  +belt_color: String
  +gender: String
  +category: String
  +weight_kg: Float
  +mod_gi: Boolean
  +mod_nogi: Boolean
  +mod_gi_extra: Boolean
  +responsavel_nome: String
  +responsavel_cpf: String
  +responsavel_telefone: String
  +status: StatusInscricao
  +valor_inscricao: Integer
  +created_at: DateTime
}

class Payment {
  +id: UUID
  +registration_id: UUID
  +gateway: String
  +gateway_payment_id: String
  +amount_cents: Integer
  +status: StatusPagamento
  +pix_copy_paste: String
  +created_at: DateTime
}

enum StatusInscricao {
  pending
  paid
}

enum StatusPagamento {
  pending
  paid
  cancelled
}

Participante "1" --> "0..*" Payment : possui
Payment --> Participante : pertence a

@enduml

-----------------------------------------------------------------------------------------------

Descrição Textual — Diagrama de Classes

O diagrama de classes descreve o modelo de domínio do sistema, representando as principais entidades e seus relacionamentos, de acordo com as regras de negócio estabelecidas.

A classe Participante representa uma inscrição no campeonato. Ela concentra informações pessoais do atleta, como nome, CPF, idade, gênero e faixa, além de dados esportivos, como categoria, peso e modalidades escolhidas. Também estão presentes campos relacionados à regra de menores de idade, que armazenam os dados do responsável legal quando aplicável. O atributo status define o estado da inscrição, podendo assumir valores como pending ou paid.

A classe Payment representa um pagamento associado a uma inscrição. Ela armazena informações referentes ao gateway de pagamento utilizado, o identificador gerado pelo provedor externo, o valor cobrado, o status do pagamento e o código PIX utilizado para a transação.

O relacionamento entre as classes estabelece que um Participante pode possuir zero ou mais pagamentos, enquanto cada pagamento está sempre associado a um único participante. Essa modelagem permite a implementação da regra de idempotência, garantindo que não existam múltiplos pagamentos pendentes simultaneamente para a mesma inscrição, ao mesmo tempo em que mantém o histórico de tentativas ou transações anteriores.

Além disso, os enums de status reforçam a padronização dos estados possíveis, tornando o modelo mais robusto, legível e alinhado às regras de negócio do sistema.