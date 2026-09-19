##Diagrama ER - Entidade - Relacionamento

@startuml
entity "participantes" as participantes {
  + id : UUID <<PK>>
  --
  full_name : text
  cpf : text <<UNIQUE>>
  age : integer
  academy : text
  belt_color : text
  gender : char
  category : text
  weight_kg : numeric
  mod_gi : boolean
  mod_nogi : boolean
  mod_gi_extra : boolean
  responsavel_nome : text
  responsavel_cpf : text
  responsavel_telefone : text
  status : text
  valor_inscricao : integer
  created_at : timestamp
}

entity "payments" as payments {
  + id : UUID <<PK>>
  --
  registration_id : UUID <<FK>>
  gateway : text
  gateway_payment_id : text
  amount_cents : integer
  status : text
  pix_copy_paste : text
  created_at : timestamp
}

participantes ||--o{ payments : "possui"

@enduml

---------------------------------------------------

Descrição Textual — Diagrama ER

O Diagrama Entidade–Relacionamento (ER) representa a estrutura do banco de dados do sistema de gestão de campeonatos de Jiu-Jitsu, evidenciando as entidades principais, seus atributos e os relacionamentos existentes entre elas.

A entidade participantes representa uma inscrição no campeonato. Cada registro corresponde a um atleta inscrito e contém informações pessoais, como nome completo, CPF e idade, além de dados esportivos, como faixa, categoria, peso e modalidades escolhidas. O CPF é definido como um atributo único, sendo utilizado como chave lógica de entrada no sistema, garantindo que não existam inscrições duplicadas para o mesmo atleta.

A entidade também contempla campos específicos para atletas menores de idade, armazenando os dados do responsável legal, como nome, CPF e telefone. Esses atributos permanecem nulos para atletas maiores de idade, sendo obrigatórios apenas quando a regra de menor de idade é aplicada. O atributo status indica o estado atual da inscrição, podendo assumir valores como pending ou paid, enquanto o campo valor_inscricao armazena o valor total calculado no momento da inscrição.

A entidade payments representa os pagamentos associados às inscrições. Cada pagamento contém informações relacionadas ao gateway utilizado, o identificador gerado pelo provedor externo, o valor cobrado em centavos, o status do pagamento e o código PIX no formato “copia e cola”. O atributo registration_id atua como chave estrangeira, estabelecendo o vínculo entre o pagamento e a inscrição correspondente.

O relacionamento entre as entidades é do tipo um-para-muitos, indicando que um participante pode possuir zero ou vários pagamentos associados, enquanto cada pagamento está obrigatoriamente vinculado a um único participante. Essa modelagem permite manter o histórico de tentativas de pagamento e implementar a regra de idempotência do sistema, assegurando que não existam múltiplos pagamentos pendentes simultaneamente para a mesma inscrição.

Esse diagrama ER fornece uma visão clara e estruturada da persistência dos dados, garantindo integridade referencial, rastreabilidade das transações e alinhamento com as regras de negócio definidas para o sistema.