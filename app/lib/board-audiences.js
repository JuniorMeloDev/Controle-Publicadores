export const BOARD_AUDIENCES = {
  todos: 'Toda a congregação',
  anciaos: 'Anciãos',
  anciaos_servos: 'Anciãos e Servos Ministeriais',
};

export function boardAudienceLabel(post) {
  return post.nome_grupo || BOARD_AUDIENCES[post.publico] || BOARD_AUDIENCES.todos;
}
